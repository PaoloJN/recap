import {
  APICallError,
  convertToModelMessages,
  type LanguageModel,
  streamText,
  toUIMessageStream,
} from "ai"
import { browser } from "wxt/browser"
import { STREAM_PORT_NAME, type StreamPortMessage, type StreamRequest } from "../lib/port-protocol"
import { buildSummaryPrompt } from "../lib/prompts/presets"
import { buildChatSystemPrompt } from "../lib/prompts/system"
import { createModel, PROVIDERS } from "../lib/providers"
import { apiKeysItem } from "../lib/storage"

export function mapStreamError(err: unknown): string {
  if (APICallError.isInstance(err)) {
    if (err.statusCode === 401 || err.statusCode === 403) {
      return "Invalid API key. Check it in Settings."
    }
    if (err.statusCode === 429) return "Rate limited by the provider. Try again shortly."
  }
  if (err instanceof Error) {
    if (err.name === "AbortError") return "Stopped."
    if (err.name === "TypeError" || err.message.includes("fetch")) {
      return "Network error reaching the provider."
    }
  } else if (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    err.name === "AbortError"
  ) {
    return "Stopped."
  }
  return err instanceof Error && err.message ? err.message : "Something went wrong."
}

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
            onError,
          })
        : (() => {
            const { system, user } = buildSummaryPrompt(req.preset, req.context)
            return streamText({ model, system, prompt: user, abortSignal: signal, onError })
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
