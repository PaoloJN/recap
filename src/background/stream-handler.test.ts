import { APICallError, RetryError, simulateReadableStream } from "ai"
import { MockLanguageModelV3 } from "ai/test"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { browser } from "wxt/browser"
import { fakeBrowser } from "wxt/testing/fake-browser"
import { STREAM_PORT_NAME, type StreamPortMessage, type StreamRequest } from "../lib/port-protocol"
import { SUMMARY_PRESETS } from "../lib/prompts/presets"
import { apiKeysItem } from "../lib/storage"
import type { VideoContext } from "../lib/types"
import { mapStreamError, registerStreamPortHandler, runStreamRequest } from "./stream-handler"

const context: VideoContext = {
  metadata: { videoId: "abc", title: "T", author: "A", durationSeconds: 60 },
  transcript: [{ text: "hello there", startMs: 0, endMs: 1000 }],
  language: "en",
}
const selection = { provider: "openai", model: "gpt-6-luna" } as const

const usage = {
  inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 0, text: 0, reasoning: 0 },
}

function helloModel() {
  return new MockLanguageModelV3({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: "text-start", id: "t1" },
          { type: "text-delta", id: "t1", delta: "Hello" },
          { type: "text-delta", id: "t1", delta: " world" },
          { type: "text-end", id: "t1" },
          { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage },
        ],
      }),
    }),
  })
}

function collect() {
  const messages: StreamPortMessage[] = []
  return { messages, post: (m: StreamPortMessage) => messages.push(m) }
}

describe("runStreamRequest", () => {
  it("streams chat text chunks then done", async () => {
    const { messages, post } = collect()
    const req: StreamRequest = {
      kind: "chat",
      messages: [{ id: "1", role: "user", parts: [{ type: "text", text: "hi" }] }],
      context,
      selection,
    }
    await runStreamRequest(req, {
      model: helloModel(),
      post,
      signal: new AbortController().signal,
    })
    const text = messages
      .flatMap((m) => (m.type === "chunk" && m.chunk.type === "text-delta" ? [m.chunk.delta] : []))
      .join("")
    expect(text).toBe("Hello world")
    expect(messages.at(-1)).toEqual({ type: "done" })
    expect(messages.some((m) => m.type === "error")).toBe(false)
  })

  it("posts a single error and no done on a 401", async () => {
    const { messages, post } = collect()
    const model = new MockLanguageModelV3({
      doStream: async () => {
        throw new APICallError({
          message: "unauthorized",
          url: "https://x",
          requestBodyValues: {},
          statusCode: 401,
          responseHeaders: {},
          responseBody: "",
          isRetryable: false,
        })
      },
    })
    await runStreamRequest(
      { kind: "summary", preset: "tldr", context, selection },
      { model, post, signal: new AbortController().signal },
    )
    const errors = messages.filter((m) => m.type === "error")
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({ message: expect.stringContaining("Invalid API key") })
    expect(messages.some((m) => m.type === "done")).toBe(false)
  })

  it("posts a single error and no done when the stream emits an error part", async () => {
    const { messages, post } = collect()
    const model = new MockLanguageModelV3({
      doStream: async () => ({
        stream: simulateReadableStream({
          chunks: [
            { type: "text-start", id: "t1" },
            { type: "text-delta", id: "t1", delta: "Hel" },
            { type: "error", error: new Error("provider exploded") },
          ],
        }),
      }),
    })
    await runStreamRequest(
      { kind: "summary", preset: "tldr", context, selection },
      { model, post, signal: new AbortController().signal },
    )
    const errors = messages.filter((m) => m.type === "error")
    expect(errors).toEqual([{ type: "error", message: "provider exploded" }])
    expect(messages.some((m) => m.type === "done")).toBe(false)
  })

  it("uses the summary prompt for summary requests", async () => {
    const { post } = collect()
    const model = helloModel()
    await runStreamRequest(
      { kind: "summary", preset: "takeaways", context, selection },
      { model, post, signal: new AbortController().signal },
    )
    const sent = JSON.stringify(model.doStreamCalls[0]?.prompt)
    expect(sent).toContain(JSON.stringify(SUMMARY_PRESETS.takeaways.instructions).slice(1, -1))
    expect(sent).toContain("hello there")
  })
})

describe("mapStreamError", () => {
  it("maps network errors", () => {
    expect(mapStreamError(new TypeError("Failed to fetch"))).toContain("Network")
  })
  it("maps rate limits", () => {
    const err = new APICallError({
      message: "slow down",
      url: "https://x",
      requestBodyValues: {},
      statusCode: 429,
    })
    expect(mapStreamError(err)).toContain("Rate limited")
  })
  it("unwraps a RetryError around a 429", () => {
    const last = new APICallError({
      message: "slow down",
      url: "https://x",
      requestBodyValues: {},
      statusCode: 429,
      isRetryable: true,
    })
    const err = new RetryError({
      message: "Failed after 2 attempts. Last error: slow down",
      reason: "maxRetriesExceeded",
      errors: [last, last],
    })
    expect(mapStreamError(err)).toBe("Rate limited by the provider. Try again shortly.")
  })
  it("maps auth failures, including Google's 400 for a bad key", () => {
    const unauthorized = new APICallError({
      message: "nope",
      url: "https://x",
      requestBodyValues: {},
      statusCode: 401,
    })
    expect(mapStreamError(unauthorized)).toBe("Invalid API key. Check it in Settings.")
    const google = new APICallError({
      message: "API key not valid. Please pass a valid API key.",
      url: "https://generativelanguage.googleapis.com/v1beta/models/x:streamGenerateContent",
      requestBodyValues: {},
      statusCode: 400,
    })
    expect(mapStreamError(google)).toBe("Invalid API key. Check it in Settings.")
  })
  it("maps a status-less APICallError (fetch failure) to a network error", () => {
    const err = new APICallError({
      message: "Cannot connect to API: Failed to fetch",
      url: "https://x",
      requestBodyValues: {},
      isRetryable: true,
    })
    const wrapped = new RetryError({
      message: "Failed after 2 attempts.",
      reason: "maxRetriesExceeded",
      errors: [err, err],
    })
    expect(mapStreamError(wrapped)).toBe("Network error reaching the provider.")
  })
  it("passes other APICallError messages through", () => {
    const err = new APICallError({
      message: "model not found",
      url: "https://x",
      requestBodyValues: {},
      statusCode: 404,
    })
    expect(mapStreamError(err)).toBe("model not found")
  })
  it("maps aborts and unknowns", () => {
    expect(mapStreamError(new DOMException("x", "AbortError"))).toBe("Stopped.")
    expect(mapStreamError("weird")).toBe("Something went wrong.")
    expect(mapStreamError(new Error("boom"))).toBe("boom")
  })
})

describe("registerStreamPortHandler", () => {
  beforeEach(async () => {
    fakeBrowser.reset()
    await apiKeysItem.setValue({})
  })

  // fakeBrowser does not implement runtime.onConnect, so capture the listener and drive it
  // with a hand-rolled port.
  function fakePort(name: string) {
    const sent: StreamPortMessage[] = []
    let onMessage: (m: unknown) => void = () => {}
    const disconnect = vi.fn()
    const port = {
      name,
      postMessage: (m: StreamPortMessage) => sent.push(m),
      onMessage: { addListener: (fn: (m: unknown) => void) => (onMessage = fn) },
      onDisconnect: { addListener: disconnect },
    }
    return { port, sent, send: (m: unknown) => onMessage(m) }
  }

  function install() {
    let listener: (port: unknown) => void = () => {}
    vi.spyOn(browser.runtime.onConnect, "addListener").mockImplementation((fn) => {
      listener = fn as (port: unknown) => void
    })
    registerStreamPortHandler()
    return (port: unknown) => listener(port)
  }

  it("replies with a missing-key error naming the provider", async () => {
    const connect = install()
    const { port, sent, send } = fakePort(STREAM_PORT_NAME)
    connect(port)
    send({ kind: "summary", preset: "tldr", context, selection } satisfies StreamRequest)
    await vi.waitFor(() => expect(sent).toHaveLength(1))
    expect(sent).toEqual([{ type: "error", message: "No API key configured for OpenAI." }])
  })

  it("ignores ports with another name", async () => {
    const connect = install()
    const { port, sent, send } = fakePort("other")
    connect(port)
    send({ kind: "summary", preset: "tldr", context, selection })
    await new Promise((r) => setTimeout(r, 20))
    expect(sent).toEqual([])
  })
})
