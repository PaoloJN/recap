import { APICallError, RetryError, simulateReadableStream } from "ai"
import { MockLanguageModelV3 } from "ai/test"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { browser } from "wxt/browser"
import { fakeBrowser } from "wxt/testing/fake-browser"
import { STREAM_PORT_NAME, type StreamPortMessage, type StreamRequest } from "../lib/port-protocol"
import { apiKeysItem, proItem } from "../lib/storage"
import type { VideoContext } from "../lib/types"
import {
  mapStreamError,
  registerStreamPortHandler,
  runProStreamRequest,
  runStreamRequest,
} from "./stream-handler"

vi.mock("../lib/pro/config", () => ({
  PRO_ORIGIN: "https://pro.test",
  PRO_ENABLED: true,
  proUrl: (path: string) => `https://pro.test${path}`,
}))

const context: VideoContext = {
  metadata: { videoId: "abc", title: "T", author: "A", durationSeconds: 60 },
  transcript: [{ text: "hello there", startMs: 0, endMs: 1000 }],
  language: "en",
}
const selection = { provider: "openai", model: "gpt-6-luna" } as const

function summaryReq(style: "tldr" | "detailed" | "moments"): StreamRequest {
  return {
    kind: "summary",
    style,
    context,
    selection,
    language: "match",
    customInstructions: "",
  }
}

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
      language: "match",
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

  it("sends expanded quote text to the model", async () => {
    const { post } = collect()
    const model = helloModel()
    const req: StreamRequest = {
      kind: "chat",
      messages: [
        {
          id: "1",
          role: "user",
          parts: [{ type: "text", text: "Why?" }],
          metadata: { quote: { seconds: 14, text: "Static" }, at: 108 },
        },
      ],
      context,
      selection,
      language: "match",
    }
    await runStreamRequest(req, { model, post, signal: new AbortController().signal })
    const prompt = JSON.stringify(model.doStreamCalls[0]?.prompt)
    expect(prompt).toContain("> [0:14] Static\\n\\nWhy?\\n\\n(asked at 1:48)")
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
    await runStreamRequest(summaryReq("tldr"), {
      model,
      post,
      signal: new AbortController().signal,
    })
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
    await runStreamRequest(summaryReq("tldr"), {
      model,
      post,
      signal: new AbortController().signal,
    })
    const errors = messages.filter((m) => m.type === "error")
    expect(errors).toEqual([{ type: "error", message: "provider exploded" }])
    expect(messages.some((m) => m.type === "done")).toBe(false)
  })

  it("uses the summary prompt for summary requests", async () => {
    const { post } = collect()
    const model = helloModel()
    await runStreamRequest(summaryReq("detailed"), {
      model,
      post,
      signal: new AbortController().signal,
    })
    const sent = JSON.stringify(model.doStreamCalls[0]?.prompt)
    expect(sent).toContain("## Key moments")
    expect(sent).toContain("hello there")
  })
})

describe("usage accounting", () => {
  function usageModel(inputTokens: number, outputTokens: number) {
    return new MockLanguageModelV3({
      doStream: async () => ({
        stream: simulateReadableStream({
          chunks: [
            { type: "text-start", id: "t1" },
            { type: "text-delta", id: "t1", delta: "Hi" },
            { type: "text-end", id: "t1" },
            {
              type: "finish",
              finishReason: { unified: "stop", raw: "stop" },
              usage: {
                inputTokens: {
                  total: inputTokens,
                  noCache: inputTokens,
                  cacheRead: 0,
                  cacheWrite: 0,
                },
                outputTokens: { total: outputTokens, text: outputTokens, reasoning: 0 },
              },
            },
          ],
        }),
      }),
    })
  }

  it("records input + output tokens after a completed summary stream", async () => {
    const recordUsage = vi.fn(async () => {})
    await runStreamRequest(summaryReq("tldr"), {
      model: usageModel(10, 20),
      post: collect().post,
      signal: new AbortController().signal,
      recordUsage,
    })
    expect(recordUsage).toHaveBeenCalledWith("summary", 30)
  })

  it("does not record usage when the stream errors", async () => {
    const recordUsage = vi.fn(async () => {})
    const model = new MockLanguageModelV3({
      doStream: async () => {
        throw new Error("boom")
      },
    })
    await runStreamRequest(summaryReq("tldr"), {
      model,
      post: collect().post,
      signal: new AbortController().signal,
      recordUsage,
    })
    expect(recordUsage).not.toHaveBeenCalled()
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
    send(summaryReq("tldr") satisfies StreamRequest)
    await vi.waitFor(() => expect(sent).toHaveLength(1))
    expect(sent).toEqual([{ type: "error", message: "No API key configured for OpenAI." }])
  })

  it("ignores ports with another name", async () => {
    const connect = install()
    const { port, sent, send } = fakePort("other")
    connect(port)
    send(summaryReq("tldr"))
    await new Promise((r) => setTimeout(r, 20))
    expect(sent).toEqual([])
  })
})

// ---------------------------------------------------------------------------------------------
// Recap Pro
// ---------------------------------------------------------------------------------------------

const proSelection = { provider: "pro", model: "pro" } as const

function proSummaryReq(): StreamRequest {
  return { ...summaryReq("tldr"), selection: proSelection }
}

function proChatReq(count: number): StreamRequest {
  const messages = Array.from({ length: count }, (_, i) => ({
    id: String(i),
    role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
    parts: [{ type: "text" as const, text: `m${i}` }],
  }))
  return { kind: "chat", messages, context, selection: proSelection, language: "match" }
}

function sse(events: unknown[]): string {
  return `${events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("")}data: [DONE]\n\n`
}

/** A fake fetch answering with an SSE body (or a JSON error) and recording the request. */
function fakeFetch(respond: () => Response) {
  const calls: { url: string; init: RequestInit; body: Record<string, unknown> }[] = []
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(url),
      init: init ?? {},
      body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
    })
    return respond()
  }) as unknown as typeof fetch
  return { fetchImpl, calls }
}

const sseResponse = (events: unknown[]) =>
  new Response(sse(events), { headers: { "content-type": "text/event-stream" } })

const jsonError = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

const HELLO_EVENTS = [
  { type: "start" },
  { type: "text-start", id: "t" },
  { type: "text-delta", id: "t", delta: "Hello" },
  { type: "text-delta", id: "t", delta: " world" },
  { type: "text-end", id: "t" },
  {
    type: "finish",
    finishReason: "stop",
    messageMetadata: { totalUsage: { inputTokens: 7, outputTokens: 5, totalTokens: 12 } },
  },
]

describe("runProStreamRequest", () => {
  beforeEach(async () => {
    fakeBrowser.reset()
    await proItem.setValue({ token: "tok", me: null, fetchedAt: 0 })
  })

  it("sends a summary as system + one user message with the device key", async () => {
    const { fetchImpl, calls } = fakeFetch(() => sseResponse(HELLO_EVENTS))
    await runProStreamRequest(proSummaryReq(), {
      token: "tok",
      post: collect().post,
      signal: new AbortController().signal,
      fetchImpl,
    })
    expect(calls).toHaveLength(1)
    const call = calls[0]
    if (!call) throw new Error("no request")
    expect(call.url).toBe("https://pro.test/api/v1/stream")
    expect((call.init.headers as Record<string, string>)["x-api-key"]).toBe("tok")
    const body = call.body as { kind: string; system: string; messages: { role: string }[] }
    expect(body.kind).toBe("summary")
    expect(body.system.length).toBeGreaterThan(0)
    expect(body.messages).toHaveLength(1)
    expect(body.messages[0]?.role).toBe("user")
    expect(JSON.stringify(body.messages)).toContain("hello there")
  })

  it("trims a 45-message chat to at most 40 user/assistant text messages", async () => {
    const { fetchImpl, calls } = fakeFetch(() => sseResponse(HELLO_EVENTS))
    const req = proChatReq(45)
    if (req.kind !== "chat") throw new Error("unreachable")
    // An assistant reply with a reasoning part must reach the server as text only.
    req.messages[1] = {
      id: "1",
      role: "assistant",
      parts: [
        { type: "reasoning", text: "thinking" },
        { type: "text", text: "m1" },
      ],
    }
    await runProStreamRequest(req, {
      token: "tok",
      post: collect().post,
      signal: new AbortController().signal,
      fetchImpl,
    })
    const body = calls[0]?.body as {
      kind: string
      messages: { role: string; content: string | { type: string; text: string }[] }[]
    }
    expect(body.kind).toBe("chat")
    expect(body.messages.length).toBeLessThanOrEqual(40)
    expect(body.messages[0]?.role).toBe("user")
    expect(body.messages.at(-1)?.role).toBe("user")
    expect(JSON.stringify(body.messages.at(-1))).toContain("m44")
    for (const m of body.messages) {
      expect(["user", "assistant"]).toContain(m.role)
      if (typeof m.content !== "string") {
        for (const part of m.content) expect(part.type).toBe("text")
      }
    }
  })

  it("forwards chunks, records usage from the finish metadata, then posts done", async () => {
    const { fetchImpl } = fakeFetch(() => sseResponse(HELLO_EVENTS))
    const { messages, post } = collect()
    const recordUsage = vi.fn(async () => {})
    await runProStreamRequest(proSummaryReq(), {
      token: "tok",
      post,
      signal: new AbortController().signal,
      fetchImpl,
      recordUsage,
    })
    const text = messages
      .flatMap((m) => (m.type === "chunk" && m.chunk.type === "text-delta" ? [m.chunk.delta] : []))
      .join("")
    expect(text).toBe("Hello world")
    expect(messages.some((m) => m.type === "chunk" && m.chunk.type === "finish")).toBe(true)
    expect(messages.at(-1)).toEqual({ type: "done" })
    expect(recordUsage).toHaveBeenCalledWith("summary", 12)
  })

  it("records nothing when the finish chunk carries no usage", async () => {
    const events = HELLO_EVENTS.map((e) => (e.type === "finish" ? { type: "finish" } : e))
    const { fetchImpl } = fakeFetch(() => sseResponse(events))
    const recordUsage = vi.fn(async () => {})
    const { messages, post } = collect()
    await runProStreamRequest(proSummaryReq(), {
      token: "tok",
      post,
      signal: new AbortController().signal,
      fetchImpl,
      recordUsage,
    })
    expect(messages.at(-1)).toEqual({ type: "done" })
    expect(recordUsage).not.toHaveBeenCalled()
  })

  it("maps 402 to upgrade_required", async () => {
    const { fetchImpl } = fakeFetch(() =>
      jsonError(402, { error: "upgrade_required", message: "Your trial has ended." }),
    )
    const { messages, post } = collect()
    await runProStreamRequest(proSummaryReq(), {
      token: "tok",
      post,
      signal: new AbortController().signal,
      fetchImpl,
    })
    expect(messages).toEqual([
      { type: "error", code: "upgrade_required", message: "Your trial has ended." },
    ])
  })

  it("carries resetsAt on 429 limit_reached", async () => {
    const resetsAt = "2026-11-01T00:00:00.000Z"
    const { fetchImpl } = fakeFetch(() =>
      jsonError(429, { error: "limit_reached", message: "Limit reached.", resetsAt }),
    )
    const { messages, post } = collect()
    await runProStreamRequest(proSummaryReq(), {
      token: "tok",
      post,
      signal: new AbortController().signal,
      fetchImpl,
    })
    expect(messages).toEqual([
      { type: "error", code: "limit_reached", message: "Limit reached.", resetsAt },
    ])
  })

  it("clears the stored token on 401", async () => {
    const { fetchImpl } = fakeFetch(() =>
      jsonError(401, { error: "unauthorized", message: "Signed out." }),
    )
    const { messages, post } = collect()
    await runProStreamRequest(proSummaryReq(), {
      token: "tok",
      post,
      signal: new AbortController().signal,
      fetchImpl,
    })
    expect(messages).toEqual([{ type: "error", code: "unauthorized", message: "Signed out." }])
    expect((await proItem.getValue()).token).toBeNull()
  })

  it("keeps a newer token when a 401 answers an older one", async () => {
    await proItem.setValue({ token: "newer", me: null, fetchedAt: 0 })
    const { fetchImpl } = fakeFetch(() => jsonError(401, { error: "unauthorized" }))
    await runProStreamRequest(proSummaryReq(), {
      token: "tok",
      post: collect().post,
      signal: new AbortController().signal,
      fetchImpl,
    })
    expect((await proItem.getValue()).token).toBe("newer")
  })

  it("forwards text before a mid-stream error chunk, then posts model_unavailable", async () => {
    const { fetchImpl } = fakeFetch(() =>
      sseResponse([
        { type: "start" },
        { type: "text-start", id: "t" },
        { type: "text-delta", id: "t", delta: "Partial" },
        { type: "error", errorText: "model_unavailable" },
      ]),
    )
    const { messages, post } = collect()
    const recordUsage = vi.fn(async () => {})
    await runProStreamRequest(proSummaryReq(), {
      token: "tok",
      post,
      signal: new AbortController().signal,
      fetchImpl,
      recordUsage,
    })
    const deltaIdx = messages.findIndex(
      (m) => m.type === "chunk" && m.chunk.type === "text-delta" && m.chunk.delta === "Partial",
    )
    expect(deltaIdx).toBeGreaterThanOrEqual(0)
    expect(messages.at(-1)).toEqual({
      type: "error",
      code: "model_unavailable",
      message: "Recap Pro lost the model mid-answer. Try again.",
    })
    expect(messages.filter((m) => m.type === "error")).toHaveLength(1)
    expect(messages.some((m) => m.type === "done")).toBe(false)
    expect(messages.some((m) => m.type === "chunk" && m.chunk.type === "error")).toBe(false)
    expect(recordUsage).not.toHaveBeenCalled()
  })

  it("aborts the fetch and the stream reader on abort and posts nothing after", async () => {
    const controller = new AbortController()
    let fetchSignal: AbortSignal | undefined
    let bodyCancelled = false
    const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
      fetchSignal = init?.signal ?? undefined
      const encoder = new TextEncoder()
      const body = new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(
            encoder.encode(
              sse([{ type: "text-delta", id: "t", delta: "a" }]).split("data: [DONE]")[0],
            ),
          )
          // Real fetch errors the body when its signal aborts.
          init?.signal?.addEventListener("abort", () =>
            c.error(new DOMException("aborted", "AbortError")),
          )
        },
        cancel() {
          bodyCancelled = true
        },
      })
      return new Response(body, { headers: { "content-type": "text/event-stream" } })
    }) as unknown as typeof fetch
    const { messages, post } = collect()
    const run = runProStreamRequest(proSummaryReq(), {
      token: "tok",
      post,
      signal: controller.signal,
      fetchImpl,
    })
    await vi.waitFor(() => expect(messages).toHaveLength(1))
    controller.abort()
    await run
    expect(fetchSignal?.aborted).toBe(true)
    expect(messages).toHaveLength(1)
    expect(bodyCancelled || fetchSignal?.aborted).toBe(true)
  })

  it("posts nothing when aborted before the response arrives", async () => {
    const controller = new AbortController()
    const fetchImpl = vi.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          if (init?.signal?.aborted) reject(new DOMException("aborted", "AbortError"))
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          )
        }),
    ) as unknown as typeof fetch
    const { messages, post } = collect()
    const run = runProStreamRequest(proSummaryReq(), {
      token: "tok",
      post,
      signal: controller.signal,
      fetchImpl,
    })
    controller.abort()
    await run
    expect(messages).toEqual([])
  })
})

describe("registerStreamPortHandler (Recap Pro)", () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it("asks to sign in when there is no Pro token", async () => {
    let listener: (port: unknown) => void = () => {}
    vi.spyOn(browser.runtime.onConnect, "addListener").mockImplementation((fn) => {
      listener = fn as (port: unknown) => void
    })
    registerStreamPortHandler()
    const sent: StreamPortMessage[] = []
    let onMessage: (m: unknown) => void = () => {}
    listener({
      name: STREAM_PORT_NAME,
      postMessage: (m: StreamPortMessage) => sent.push(m),
      onMessage: { addListener: (fn: (m: unknown) => void) => (onMessage = fn) },
      onDisconnect: { addListener: vi.fn() },
    })
    onMessage(proSummaryReq())
    await vi.waitFor(() => expect(sent).toHaveLength(1))
    expect(sent).toEqual([
      { type: "error", code: "unauthorized", message: "Sign in to use Recap Pro." },
    ])
  })
})
