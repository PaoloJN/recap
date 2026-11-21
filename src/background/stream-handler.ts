import { createOpenAI } from "@ai-sdk/openai"
import {
  APICallError,
  convertToModelMessages,
  type LanguageModel,
  RetryError,
  streamText,
  type ToolSet,
  toUIMessageStream,
} from "ai"
import { browser } from "wxt/browser"
import { STREAM_PORT_NAME, type StreamPortMessage, type StreamRequest } from "../lib/port-protocol"
import { expandUserMessages } from "../lib/prompts/chat-messages"
import { buildClassifyPrompt } from "../lib/prompts/classify"
import { buildDiagramPrompt } from "../lib/prompts/diagram"
import { buildSummaryPrompt } from "../lib/prompts/summary"
import { buildChatSystemPrompt } from "../lib/prompts/system"
import { createModel, PROVIDERS } from "../lib/providers"
import {
  isReasoningRejection,
  REASONING_NOTE,
  type ReasoningProviderOptions,
  reasoningProviderOptions,
} from "../lib/reasoning"
import { recordUsage as addUsage, apiKeysItem, monthKey, usageItem } from "../lib/storage"
import {
  buildAuthorViewPrompt,
  buildConceptsPrompt,
  buildGradePrompt,
  buildQuizPrompt,
} from "../lib/tutor/prompts"
import {
  isWebToolRejection,
  openRouterOnlineModel,
  WEB_NOTE,
  webPlan,
  withoutWeb,
} from "../lib/tutor/web"
import { runChatGptRequest } from "./chatgpt-stream"

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

type UsageKind = "summary" | "chat" | "diagram"

export type StreamAttemptResult = "ok" | "error" | "reasoning-rejected" | "web-rejected" | "both"

interface StreamDeps {
  model: LanguageModel
  post: (m: StreamPortMessage) => void
  signal: AbortSignal
  tools?: ToolSet
  providerOptions?: ReasoningProviderOptions
  /** Appended to the answer when this attempt finishes. */
  note?: string
  /** A rejected reasoning or web parameter returns a status instead of posting an error. */
  detectRejection?: boolean
  recordUsage?: (kind: StreamRequest["kind"], tokens: number) => Promise<void>
}

function clampTokens(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0
}

function usageKind(kind: StreamRequest["kind"]): UsageKind {
  if (kind === "summary" || kind === "diagram") return kind
  return "chat"
}

function rejectionOf(err: unknown): "reasoning" | "web" | "both" | null {
  const raw = unwrapRetryError(err)
  const status = APICallError.isInstance(raw) ? raw.statusCode : undefined
  const message = raw instanceof Error ? raw.message : ""
  const reasoning = isReasoningRejection(status, message)
  const web = isWebToolRejection(status, message)
  if (reasoning && web) return "both"
  if (reasoning) return "reasoning"
  if (web) return "web"
  return null
}

async function defaultRecordUsage(kind: StreamRequest["kind"], tokens: number): Promise<void> {
  const store = await usageItem.getValue()
  await usageItem.setValue(addUsage(store, monthKey(new Date()), usageKind(kind), tokens))
}

function promptFor(req: Exclude<StreamRequest, { kind: "chat" }>): {
  system: string
  user: string
} {
  if (req.kind === "summary") {
    return buildSummaryPrompt(req.style, req.context, {
      language: req.language,
      customInstructions: req.customInstructions,
      videoTypePrompt: req.videoTypePrompt,
    })
  }
  if (req.kind === "diagram") {
    return buildDiagramPrompt(req.context, {
      language: req.language,
      customInstructions: req.customInstructions,
      detail: req.detail,
      videoType: req.videoType,
      repair: req.repair,
    })
  }
  if (req.kind === "concepts") {
    return buildConceptsPrompt(req.context, {
      language: req.language,
      customInstructions: req.customInstructions,
      tutor: req.tutor,
      role: req.role,
    })
  }
  if (req.kind === "quiz") {
    return buildQuizPrompt(req.context, {
      language: req.language,
      customInstructions: req.customInstructions,
      tutor: req.tutor,
      role: req.role,
    })
  }
  if (req.kind === "classify") return buildClassifyPrompt(req.context)
  if (req.kind === "author") {
    return buildAuthorViewPrompt(req.context, {
      customInstructions: req.customInstructions,
      role: req.role,
    })
  }
  if (req.kind !== "grade") throw new Error("Unsupported tutor task.")
  return buildGradePrompt(req.context, {
    language: req.language,
    tutor: req.tutor,
    role: req.role,
    answers: req.answers,
  })
}

function noteDelta(id: string, note: string) {
  const delta = note.startsWith("\n") ? note : `\n\n${note}`
  return { type: "text-delta" as const, id, delta }
}

export async function runStreamRequest(
  req: StreamRequest,
  deps: StreamDeps,
): Promise<StreamAttemptResult> {
  const { model, post, signal } = deps
  let postedText = false
  const finishRejection = (err: unknown): StreamAttemptResult | undefined => {
    if (!deps.detectRejection || postedText || signal.aborted) return undefined
    const kind = rejectionOf(err)
    if (!kind) return undefined
    if (kind === "both") return "both"
    if (kind === "reasoning") return "reasoning-rejected"
    return "web-rejected"
  }
  try {
    let streamError: unknown
    const onError = ({ error }: { error: unknown }) => {
      streamError ??= error
    }
    const extras = {
      ...(deps.tools ? { tools: deps.tools } : {}),
      ...(deps.providerOptions ? { providerOptions: deps.providerOptions } : {}),
    }
    const result =
      req.kind === "chat"
        ? streamText({
            model,
            system: buildChatSystemPrompt(
              req.context,
              req.language,
              req.tutor && {
                mode: req.tutor.mode,
                level: req.tutor.level,
                role: req.role,
                customInstructions: req.customInstructions,
              },
              req.web === true,
            ),
            messages: await convertToModelMessages(expandUserMessages(req.messages)),
            abortSignal: signal,
            maxRetries: MAX_RETRIES,
            onError,
            ...extras,
          })
        : (() => {
            const { system, user } = promptFor(req)
            return streamText({
              model,
              system,
              prompt: user,
              abortSignal: signal,
              maxRetries: MAX_RETRIES,
              onError,
              ...extras,
            })
          })()
    let textId: string | undefined
    for await (const chunk of toUIMessageStream({ stream: result.stream })) {
      if (chunk.type === "error") {
        streamError ??= new Error(chunk.errorText)
        continue
      }
      if (chunk.type === "text-start") textId = chunk.id
      if (chunk.type === "text-delta" && chunk.delta) postedText = true
      if (chunk.type === "text-end" && deps.note && textId) {
        post({ type: "chunk", chunk: noteDelta(textId, deps.note) })
      }
      post({ type: "chunk", chunk })
    }
    if (streamError !== undefined && !signal.aborted) {
      const rejected = finishRejection(streamError)
      if (rejected) return rejected
      post({ type: "error", message: mapStreamError(streamError) })
      return "error"
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
    return "ok"
  } catch (e) {
    const rejected = finishRejection(e)
    if (rejected) return rejected
    post({ type: "error", message: mapStreamError(e) })
    return "error"
  }
}

async function runSdkRequest(
  req: StreamRequest,
  key: string,
  post: (m: StreamPortMessage) => void,
  signal: AbortSignal,
): Promise<void> {
  const provider = req.selection.provider
  const wantWeb = (req.kind === "chat" || req.kind === "author") && req.web === true
  const plan = wantWeb ? webPlan(provider) : "none"
  const online = plan === "openrouter"
  let modelId = online ? openRouterOnlineModel(req.selection.model) : req.selection.model
  let tools: ToolSet | undefined
  if (plan === "responses" && provider === "openai") {
    tools = { web_search: createOpenAI({ apiKey: key }).tools.webSearch() }
  }
  let providerOptions = reasoningProviderOptions(provider, req.selection.model, req.reasoningEffort)
  const skippedWeb = wantWeb && plan === "none"
  // WHY: without a web tool the prompt must not promise web sources, or the model invents links.
  const firstReq = skippedWeb ? withoutWeb(req) : req
  const first = await runStreamRequest(firstReq, {
    model: createModel({ ...req.selection, model: modelId }, key),
    tools,
    providerOptions,
    note: skippedWeb ? WEB_NOTE : undefined,
    detectRejection: Boolean(tools) || online || providerOptions !== undefined,
    post,
    signal,
    recordUsage: defaultRecordUsage,
  })
  if (first === "ok" || first === "error") return
  const notes = [
    skippedWeb ? WEB_NOTE : "",
    first === "web-rejected" || first === "both" ? WEB_NOTE : "",
  ]
  if (first === "reasoning-rejected" || first === "both") {
    notes.push(REASONING_NOTE)
    providerOptions = undefined
  }
  let next = firstReq
  if (first === "web-rejected" || first === "both") {
    tools = undefined
    modelId = req.selection.model
    next = withoutWeb(next)
  }
  await runStreamRequest(next, {
    model: createModel({ ...req.selection, model: modelId }, key),
    tools,
    providerOptions,
    note: notes.filter(Boolean).join("\n\n") || undefined,
    post,
    signal,
    recordUsage: defaultRecordUsage,
  })
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
        if (req.selection.provider === "chatgpt") {
          await runChatGptRequest(req, {
            post,
            signal: controller.signal,
            recordUsage: defaultRecordUsage,
          })
          return
        }
        const keys = await apiKeysItem.getValue()
        const key = keys[req.selection.provider]
        if (!key) {
          post({
            type: "error",
            message: `No API key configured for ${PROVIDERS[req.selection.provider].label}.`,
          })
          return
        }
        await runSdkRequest(req, key, post, controller.signal)
      } catch (e) {
        post({ type: "error", message: mapStreamError(e) })
      }
    })
  })
}
