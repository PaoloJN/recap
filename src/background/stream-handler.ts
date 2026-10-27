import {
  APICallError,
  convertToModelMessages,
  type LanguageModel,
  type ModelMessage,
  RetryError,
  streamText,
  toUIMessageStream,
  type UIMessageChunk,
} from "ai"
import { browser } from "wxt/browser"
import { STREAM_PORT_NAME, type StreamPortMessage, type StreamRequest } from "../lib/port-protocol"
import { ProError, streamRequest } from "../lib/pro/api"
import { readUiChunks } from "../lib/pro/sse"
import { trimForPro } from "../lib/pro/trim"
import { expandUserMessages } from "../lib/prompts/chat-messages"
import { buildSummaryPrompt } from "../lib/prompts/summary"
import { buildChatSystemPrompt } from "../lib/prompts/system"
import { createModel, isByok, PROVIDERS } from "../lib/providers"
import { recordUsage as addUsage, apiKeysItem, monthKey, proItem, usageItem } from "../lib/storage"

const INVALID_KEY = "Invalid API key. Check it in Settings."
const RATE_LIMITED = "Rate limited by the provider. Try again shortly."
const NETWORK = "Network error reaching the provider."
const STOPPED = "Stopped."

function unwrapRetryError(err: unknown): unknown {
  if (!RetryError.isInstance(err)) return err
  return err.lastError ?? err.errors.at(-1) ?? err
}

function isAbortError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "name" in err && err.name === "AbortError"
}

export function mapStreamError(raw: unknown): string {
  const err = unwrapRetryError(raw)
  if (APICallError.isInstance(err)) {
    const { statusCode, message } = err
    if (statusCode === 401 || statusCode === 403) return INVALID_KEY
    if (statusCode === 429) return RATE_LIMITED
    // Google answers a bad key with 400 rather than 401.
    if (
      statusCode === 400 &&
      (message.includes("API key not valid") || message.includes("API_KEY_INVALID"))
    ) {
      return INVALID_KEY
    }
    // provider-utils wraps fetch failures as an APICallError with no status code.
    if (statusCode === undefined) return NETWORK
  }
  const abort = isAbortError(err)
  if (
    !abort &&
    err instanceof Error &&
    (err.name === "TypeError" || err.message.includes("fetch"))
  ) {
    return NETWORK
  }
  if (abort) return STOPPED
  return err instanceof Error && err.message ? err.message : "Something went wrong."
}

// Interactive UI: one quick retry, not the SDK's default of two with long backoff.
const MAX_RETRIES = 1

interface StreamDeps {
  model: LanguageModel
  post: (m: StreamPortMessage) => void
  signal: AbortSignal
  recordUsage?: (kind: "summary" | "chat", tokens: number) => Promise<void>
}

function clampTokens(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0
}

async function defaultRecordUsage(kind: "summary" | "chat", tokens: number): Promise<void> {
  const store = await usageItem.getValue()
  await usageItem.setValue(addUsage(store, monthKey(new Date()), kind, tokens))
}

/** System prompt + model messages for a request. Shared by the BYOK and Recap Pro paths. */
export async function buildStreamPrompt(
  req: StreamRequest,
): Promise<{ system: string; messages: ModelMessage[] }> {
  if (req.kind === "chat") {
    return {
      system: buildChatSystemPrompt(req.context, req.language),
      messages: await convertToModelMessages(expandUserMessages(req.messages)),
    }
  }
  const { system, user } = buildSummaryPrompt(req.style, req.context, {
    language: req.language,
    customInstructions: req.customInstructions,
  })
  return { system, messages: [{ role: "user", content: user }] }
}

export async function runStreamRequest(req: StreamRequest, deps: StreamDeps): Promise<void> {
  const { model, post, signal } = deps
  try {
    let streamError: unknown
    const { system, messages } = await buildStreamPrompt(req)
    const result = streamText({
      model,
      system,
      messages,
      abortSignal: signal,
      maxRetries: MAX_RETRIES,
      onError: ({ error }: { error: unknown }) => {
        streamError ??= error
      },
    })
    for await (const chunk of toUIMessageStream({ stream: result.stream })) {
      if (chunk.type === "error") {
        streamError ??= new Error(chunk.errorText)
        continue
      }
      post({ type: "chunk", chunk })
    }
    if (streamError !== undefined && !signal.aborted) {
      post({ type: "error", message: mapStreamError(streamError) })
      return
    }
    if (!signal.aborted && deps.recordUsage) {
      try {
        const u = await result.totalUsage
        await deps.recordUsage(req.kind, clampTokens((u.inputTokens ?? 0) + (u.outputTokens ?? 0)))
      } catch (e) {
        console.error("Failed to record usage", e)
      }
    }
    post({ type: "done" })
  } catch (e) {
    post({ type: "error", message: mapStreamError(e) })
  }
}

// --- Recap Pro ---------------------------------------------------------------------------------

const PRO_MID_STREAM = "Recap Pro lost the model mid-answer. Try again."
const PRO_NETWORK = "Can't reach Recap Pro. Check your connection."
const PRO_INTERNAL = "Recap Pro hit an error. Try again."

interface ProStreamDeps {
  token: string
  post: (m: StreamPortMessage) => void
  signal: AbortSignal
  fetchImpl?: typeof fetch
  recordUsage?: (kind: "summary" | "chat", tokens: number) => Promise<void>
}

/**
 * The server accepts only user/assistant messages with string or text-part content. Keeps the
 * text of each message and drops everything else (reasoning, files, tool calls, system).
 */
export function toProMessages(messages: ModelMessage[]): ModelMessage[] {
  const out: ModelMessage[] = []
  for (const m of messages) {
    if (m.role !== "user" && m.role !== "assistant") continue
    if (typeof m.content === "string") {
      if (m.content !== "") out.push({ role: m.role, content: m.content })
      continue
    }
    const content = m.content.flatMap((p) =>
      p.type === "text" && p.text !== "" ? [{ type: "text" as const, text: p.text }] : [],
    )
    if (content.length > 0) out.push({ role: m.role, content })
  }
  return out
}

/** Input + output tokens from the server's `finish` metadata, or null when it carries none. */
function usageFromFinish(chunk: UIMessageChunk): number | null {
  if (chunk.type !== "finish") return null
  const meta = chunk.messageMetadata
  if (typeof meta !== "object" || meta === null) return null
  const usage = (meta as { totalUsage?: unknown }).totalUsage
  if (typeof usage !== "object" || usage === null) return null
  const { inputTokens, outputTokens } = usage as { inputTokens?: unknown; outputTokens?: unknown }
  const input = typeof inputTokens === "number" ? inputTokens : 0
  const output = typeof outputTokens === "number" ? outputTokens : 0
  if (typeof inputTokens !== "number" && typeof outputTokens !== "number") return null
  return clampTokens(input + output)
}

/** Signs out after a 401, unless a newer sign-in already replaced the token used here. */
async function clearProToken(token: string): Promise<void> {
  const current = await proItem.getValue()
  if (current.token === token) await proItem.setValue({ token: null, me: null, fetchedAt: 0 })
}

export async function runProStreamRequest(req: StreamRequest, deps: ProStreamDeps): Promise<void> {
  const { token, post, signal } = deps
  try {
    const { system, messages } = await buildStreamPrompt(req)
    const body = {
      kind: req.kind,
      system,
      messages: req.kind === "chat" ? trimForPro(system, toProMessages(messages)) : messages,
    }
    if (signal.aborted) return
    const res = await streamRequest(token, body, signal, deps.fetchImpl)
    let tokens: number | null = null
    for await (const chunk of readUiChunks(res)) {
      if (signal.aborted) return
      if (chunk.type === "error") {
        post({ type: "error", code: "model_unavailable", message: PRO_MID_STREAM })
        return
      }
      tokens = usageFromFinish(chunk) ?? tokens
      post({ type: "chunk", chunk })
    }
    if (signal.aborted) return
    if (tokens !== null && deps.recordUsage) {
      try {
        await deps.recordUsage(req.kind, tokens)
      } catch (e) {
        console.error("Failed to record usage", e)
      }
    }
    post({ type: "done" })
  } catch (e) {
    if (signal.aborted) return
    if (e instanceof ProError) {
      if (e.code === "unauthorized") {
        await clearProToken(token).catch((err) => console.error("Failed to clear Pro token", err))
      }
      post({
        type: "error",
        code: e.code,
        message: e.message,
        ...(e.resetsAt !== undefined ? { resetsAt: e.resetsAt } : {}),
      })
      return
    }
    // A body that fails mid-read is a dropped connection; anything else is our own fault.
    const network = e instanceof TypeError
    if (!network) console.error("Recap Pro stream failed", e)
    post({
      type: "error",
      code: network ? "network" : "internal_error",
      message: network ? PRO_NETWORK : PRO_INTERNAL,
    })
  }
}

function safePost(
  port: { postMessage: (m: StreamPortMessage) => void },
  isDisconnected: () => boolean,
  m: StreamPortMessage,
) {
  if (isDisconnected()) return
  try {
    port.postMessage(m)
  } catch (e) {
    if (e instanceof Error && /disconnected/i.test(e.message)) return
    console.error("Failed to post stream message", e)
  }
}

export function registerStreamPortHandler(): void {
  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== STREAM_PORT_NAME) return
    const controller = new AbortController()
    let started = false
    let disconnected = false
    port.onDisconnect.addListener(() => {
      disconnected = true
      controller.abort()
    })
    port.onMessage.addListener(async (raw) => {
      if (started) return
      started = true
      const req = raw as StreamRequest
      const post = (m: StreamPortMessage) => safePost(port, () => disconnected, m)
      try {
        const selection = req.selection
        if (!isByok(selection.provider)) {
          const { token } = await proItem.getValue()
          if (!token) {
            post({ type: "error", code: "unauthorized", message: "Sign in to use Recap Pro." })
            return
          }
          await runProStreamRequest(req, {
            token,
            post,
            signal: controller.signal,
            recordUsage: defaultRecordUsage,
          })
          return
        }
        const byok = { provider: selection.provider, model: selection.model }
        const keys = await apiKeysItem.getValue()
        const key = keys[byok.provider]
        if (!key) {
          post({
            type: "error",
            message: `No API key configured for ${PROVIDERS[byok.provider].label}.`,
          })
          return
        }
        await runStreamRequest(req, {
          model: createModel(byok, key),
          post,
          signal: controller.signal,
          recordUsage: defaultRecordUsage,
        })
      } catch (e) {
        post({ type: "error", message: mapStreamError(e) })
      }
    })
  })
}
