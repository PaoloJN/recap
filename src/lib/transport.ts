import type { ChatTransport, UIMessage, UIMessageChunk } from "ai"
import { browser } from "wxt/browser"
import { STREAM_PORT_NAME, type StreamPortMessage, type StreamRequest } from "./port-protocol"
import type { ProErrorCode } from "./pro/types"
import type { AnswerLanguage, ModelSelection, VideoContext } from "./types"

export interface PortLike {
  postMessage(m: unknown): void
  disconnect(): void
  onMessage: {
    addListener(fn: (m: StreamPortMessage) => void): void
    removeListener(fn: (m: StreamPortMessage) => void): void
  }
  onDisconnect: {
    addListener(fn: () => void): void
    removeListener(fn: () => void): void
  }
}

export type PortFactory = () => PortLike

/** A stream failure. `message` is user-facing; `code` is set for Recap Pro errors. */
export class StreamError extends Error {
  readonly code?: ProErrorCode
  readonly resetsAt?: string

  constructor(message: string, opts: { code?: ProErrorCode; resetsAt?: string } = {}) {
    super(message)
    this.name = "StreamError"
    if (opts.code !== undefined) this.code = opts.code
    if (opts.resetsAt !== undefined) this.resetsAt = opts.resetsAt
  }
}

const defaultConnect: PortFactory = () => browser.runtime.connect({ name: STREAM_PORT_NAME })

export function openStream(
  req: StreamRequest,
  opts: { connect?: PortFactory; signal?: AbortSignal } = {},
): ReadableStream<UIMessageChunk> {
  const port = (opts.connect ?? defaultConnect)()
  const signal = opts.signal
  let cleanup = () => {}

  return new ReadableStream<UIMessageChunk>({
    start(controller) {
      let settled = false

      const settle = (finish: () => void) => {
        if (settled) return
        settled = true
        cleanup()
        finish()
      }

      const onMessage = (m: StreamPortMessage) => {
        if (settled) return
        if (m.type === "chunk") {
          controller.enqueue(m.chunk)
        } else if (m.type === "done") {
          settle(() => {
            controller.close()
            port.disconnect()
          })
        } else {
          settle(() => {
            controller.error(new StreamError(m.message, { code: m.code, resetsAt: m.resetsAt }))
            port.disconnect()
          })
        }
      }
      const onDisconnect = () => {
        settle(() =>
          controller.error(
            new StreamError("Connection to the extension was lost", { code: "network" }),
          ),
        )
      }
      const onAbort = () => {
        settle(() => {
          port.disconnect()
          controller.close()
        })
      }

      cleanup = () => {
        port.onMessage.removeListener(onMessage)
        port.onDisconnect.removeListener(onDisconnect)
        signal?.removeEventListener("abort", onAbort)
      }

      port.onMessage.addListener(onMessage)
      port.onDisconnect.addListener(onDisconnect)
      if (signal?.aborted) {
        onAbort()
        return
      }
      signal?.addEventListener("abort", onAbort)
      port.postMessage(req)
    },
    cancel() {
      cleanup()
      port.disconnect()
    },
  })
}

export async function readTextFromUIStream(
  stream: ReadableStream<UIMessageChunk>,
  onText?: (full: string) => void,
): Promise<string> {
  const reader = stream.getReader()
  let full = ""
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) return full
      if (value.type === "text-delta") {
        full += value.delta
        onText?.(full)
      }
    }
  } finally {
    reader.releaseLock()
  }
}

type SendOptions = Parameters<ChatTransport<UIMessage>["sendMessages"]>[0]
type ReconnectOptions = Parameters<ChatTransport<UIMessage>["reconnectToStream"]>[0]

export class PortChatTransport implements ChatTransport<UIMessage> {
  constructor(
    private getContext: () => {
      context: VideoContext
      selection: ModelSelection
      language: AnswerLanguage
    },
    private connect?: PortFactory,
  ) {}

  async sendMessages(opts: SendOptions): Promise<ReadableStream<UIMessageChunk>> {
    return openStream(
      { kind: "chat", messages: opts.messages, ...this.getContext() },
      { connect: this.connect, signal: opts.abortSignal },
    )
  }

  async reconnectToStream(_opts?: ReconnectOptions): Promise<null> {
    return null
  }
}
