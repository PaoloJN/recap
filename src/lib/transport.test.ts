import type { UIMessage, UIMessageChunk } from "ai"
import { describe, expect, it } from "vitest"
import type { StreamPortMessage } from "./port-protocol"
import { openStream, PortChatTransport, type PortLike, readTextFromUIStream } from "./transport"
import type { ModelSelection, SummaryStyle, VideoContext } from "./types"

class FakePort implements PortLike {
  posted: unknown[] = []
  disconnectCalls = 0
  private messageListeners = new Set<(m: StreamPortMessage) => void>()
  private disconnectListeners = new Set<() => void>()
  onMessage = {
    addListener: (fn: (m: StreamPortMessage) => void) => void this.messageListeners.add(fn),
    removeListener: (fn: (m: StreamPortMessage) => void) => void this.messageListeners.delete(fn),
  }
  onDisconnect = {
    addListener: (fn: () => void) => void this.disconnectListeners.add(fn),
    removeListener: (fn: () => void) => void this.disconnectListeners.delete(fn),
  }
  postMessage(m: unknown) {
    this.posted.push(m)
  }
  disconnect() {
    this.disconnectCalls++
  }
  emit(m: StreamPortMessage) {
    for (const fn of [...this.messageListeners]) fn(m)
  }
  emitDisconnect() {
    for (const fn of [...this.disconnectListeners]) fn()
  }
  get listenerCount() {
    return this.messageListeners.size + this.disconnectListeners.size
  }
}

const context = { videoId: "abc" } as unknown as VideoContext
const selection = { provider: "openai", model: "gpt-6-luna" } as unknown as ModelSelection
const summaryReq = {
  kind: "summary" as const,
  preset: "tldr" as unknown as SummaryStyle,
  context,
  selection,
}
const delta = (d: string): UIMessageChunk => ({ type: "text-delta", id: "t", delta: d })

describe("openStream", () => {
  it("posts the request once and streams chunks in order until done", async () => {
    const port = new FakePort()
    const stream = openStream(summaryReq, { connect: () => port })
    expect(port.posted).toEqual([summaryReq])
    const a = delta("a")
    const b = delta("b")
    port.emit({ type: "chunk", chunk: a })
    port.emit({ type: "chunk", chunk: b })
    port.emit({ type: "done" })
    const reader = stream.getReader()
    expect(await reader.read()).toEqual({ done: false, value: a })
    expect(await reader.read()).toEqual({ done: false, value: b })
    expect((await reader.read()).done).toBe(true)
    expect(port.posted).toHaveLength(1)
    expect(port.disconnectCalls).toBe(1)
    expect(port.listenerCount).toBe(0)
  })

  it("errors the reader with the error message", async () => {
    const port = new FakePort()
    const stream = openStream(summaryReq, { connect: () => port })
    port.emit({ type: "error", message: "bad key" })
    await expect(stream.getReader().read()).rejects.toThrow("bad key")
    expect(port.disconnectCalls).toBe(1)
  })

  it("errors when the port disconnects before done", async () => {
    const port = new FakePort()
    const stream = openStream(summaryReq, { connect: () => port })
    port.emitDisconnect()
    await expect(stream.getReader().read()).rejects.toThrow("Connection to the extension was lost")
    expect(port.listenerCount).toBe(0)
  })

  it("disconnects and closes when the signal aborts", async () => {
    const port = new FakePort()
    const ac = new AbortController()
    const stream = openStream(summaryReq, { connect: () => port, signal: ac.signal })
    ac.abort()
    expect(port.disconnectCalls).toBe(1)
    expect((await stream.getReader().read()).done).toBe(true)
  })

  it("disconnects when the consumer cancels", async () => {
    const port = new FakePort()
    const stream = openStream(summaryReq, { connect: () => port })
    await stream.cancel()
    expect(port.disconnectCalls).toBe(1)
    expect(port.listenerCount).toBe(0)
  })

  it("ignores late messages and disconnects after done", async () => {
    const port = new FakePort()
    const stream = openStream(summaryReq, { connect: () => port })
    port.emit({ type: "done" })
    expect(() => {
      port.emit({ type: "chunk", chunk: delta("late") })
      port.emit({ type: "error", message: "late" })
      port.emitDisconnect()
    }).not.toThrow()
    expect((await stream.getReader().read()).done).toBe(true)
  })
})

describe("readTextFromUIStream", () => {
  it("accumulates text-delta chunks and reports progress", async () => {
    const port = new FakePort()
    const stream = openStream(summaryReq, { connect: () => port })
    port.emit({ type: "chunk", chunk: { type: "text-start", id: "t" } })
    port.emit({ type: "chunk", chunk: delta("Hel") })
    port.emit({ type: "chunk", chunk: delta("lo") })
    port.emit({ type: "done" })
    const seen: string[] = []
    const text = await readTextFromUIStream(stream, (t) => seen.push(t))
    expect(text).toBe("Hello")
    expect(seen).toEqual(["Hel", "Hello"])
  })

  it("rejects when the stream errors", async () => {
    const port = new FakePort()
    const stream = openStream(summaryReq, { connect: () => port })
    port.emit({ type: "chunk", chunk: delta("x") })
    port.emit({ type: "error", message: "boom" })
    await expect(readTextFromUIStream(stream)).rejects.toThrow("boom")
  })
})

describe("PortChatTransport", () => {
  it("sends a chat request with messages and context", async () => {
    const port = new FakePort()
    const transport = new PortChatTransport(
      () => ({ context, selection }),
      () => port,
    )
    const messages: UIMessage[] = [{ id: "1", role: "user", parts: [{ type: "text", text: "hi" }] }]
    const stream = await transport.sendMessages({
      trigger: "submit-message",
      chatId: "c",
      messageId: undefined,
      messages,
      abortSignal: undefined,
    })
    expect(port.posted).toEqual([{ kind: "chat", messages, context, selection }])
    port.emit({ type: "done" })
    expect((await stream.getReader().read()).done).toBe(true)
  })

  it("reconnectToStream resolves null", async () => {
    const transport = new PortChatTransport(() => ({ context, selection }))
    expect(await transport.reconnectToStream({ chatId: "c" })).toBeNull()
  })
})
