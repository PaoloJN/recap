import {
  APICallError,
  convertToModelMessages,
  type LanguageModel,
  RetryError,
  streamText,
  toUIMessageStream,
} from "ai"
import { browser } from "wxt/browser"
import { STREAM_PORT_NAME, type StreamPortMessage, type StreamRequest } from "../lib/port-protocol"
import { buildSummaryPrompt } from "../lib/prompts/presets"
import { buildChatSystemPrompt } from "../lib/prompts/system"
import { createModel, PROVIDERS } from "../lib/providers"
import { apiKeysItem } from "../lib/storage"

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
}

export async function runStreamRequest(req: StreamRequest, deps: StreamDeps): Promise<void> {
  const { model, post, signal } = deps
  try {
    let streamError: unknown
    const onError = ({ error }: { error: unknown }) => {
      streamError ??= error
    }
    const result =
      req.kind === "chat"
        ? streamText({
            model,
            system: buildChatSystemPrompt(req.context),
            messages: await convertToModelMessages(req.messages),
            abortSignal: signal,
            maxRetries: MAX_RETRIES,
            onError,
          })
        : (() => {
            const { system, user } = buildSummaryPrompt(req.preset, req.context)
            return streamText({
              model,
              system,
              prompt: user,
              abortSignal: signal,
              maxRetries: MAX_RETRIES,
              onError,
            })
          })()
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
    post({ type: "done" })
  } catch (e) {
    post({ type: "error", message: mapStreamError(e) })
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
        const keys = await apiKeysItem.getValue()
        const key = keys[req.selection.provider]
        if (!key) {
          post({
            type: "error",
            message: `No API key configured for ${PROVIDERS[req.selection.provider].label}.`,
          })
          return
        }
        await runStreamRequest(req, {
          model: createModel(req.selection, key),
          post,
          signal: controller.signal,
        })
      } catch (e) {
        post({ type: "error", message: mapStreamError(e) })
      }
    })
  })
}
