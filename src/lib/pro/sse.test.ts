import type { UIMessageChunk } from "ai"
import { describe, expect, it, vi } from "vitest"
import { readUiChunks } from "./sse"

/** A Response whose body emits `text` split into the given byte-sized pieces. */
function sseResponse(text: string, pieceSizes: number[]): Response {
  const bytes = new TextEncoder().encode(text)
  const pieces: Uint8Array[] = []
  let at = 0
  let i = 0
  while (at < bytes.length) {
    const size = pieceSizes[i++ % pieceSizes.length] ?? 1
    pieces.push(bytes.slice(at, at + size))
    at += size
  }
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const p of pieces) controller.enqueue(p)
      controller.close()
    },
  })
  return new Response(body, { headers: { "content-type": "text/event-stream" } })
}

async function collect(res: Response): Promise<UIMessageChunk[]> {
  const out: UIMessageChunk[] = []
  for await (const chunk of readUiChunks(res)) out.push(chunk)
  return out
}

const event = (value: unknown) => `data: ${JSON.stringify(value)}\n\n`

describe("readUiChunks", () => {
  const body =
    event({ type: "start" }) +
    event({ type: "text-start", id: "t1" }) +
    event({ type: "text-delta", id: "t1", delta: "Héllo " }) +
    event({ type: "text-delta", id: "t1", delta: "wörld 👋" }) +
    event({ type: "text-end", id: "t1" }) +
    event({
      type: "finish",
      messageMetadata: { totalUsage: { inputTokens: 3, outputTokens: 4 } },
    }) +
    "data: [DONE]\n\n"

  it.each([[[1]], [[3, 7]], [[5, 1, 11]], [[64]], [[100_000]]])(
    "yields chunks in order across byte boundaries %j",
    async (sizes) => {
      const chunks = await collect(sseResponse(body, sizes))
      expect(chunks.map((c) => c.type)).toEqual([
        "start",
        "text-start",
        "text-delta",
        "text-delta",
        "text-end",
        "finish",
      ])
      const text = chunks
        .filter(
          (c): c is Extract<UIMessageChunk, { type: "text-delta" }> => c.type === "text-delta",
        )
        .map((c) => c.delta)
        .join("")
      expect(text).toBe("Héllo wörld 👋")
      const finish = chunks.at(-1) as Extract<UIMessageChunk, { type: "finish" }>
      expect(finish.messageMetadata).toEqual({ totalUsage: { inputTokens: 3, outputTokens: 4 } })
    },
  )

  it("handles CRLF line endings and comments", async () => {
    const crlf = `: keep-alive\r\n\r\n${event({ type: "text-delta", id: "t", delta: "a" }).replace(/\n/g, "\r\n")}data: [DONE]\r\n\r\n`
    const chunks = await collect(sseResponse(crlf, [2]))
    expect(chunks).toEqual([{ type: "text-delta", id: "t", delta: "a" }])
  })

  it("yields an error chunk", async () => {
    const text =
      event({ type: "text-delta", id: "t", delta: "partial" }) +
      event({ type: "error", errorText: "model_unavailable" })
    const chunks = await collect(sseResponse(text, [9]))
    expect(chunks).toEqual([
      { type: "text-delta", id: "t", delta: "partial" },
      { type: "error", errorText: "model_unavailable" },
    ])
  })

  it("skips malformed events with a warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const text = `data: {not json\n\n${event({ type: "text-delta", id: "t", delta: "ok" })}`
    const chunks = await collect(sseResponse(text, [4]))
    expect(chunks).toEqual([{ type: "text-delta", id: "t", delta: "ok" }])
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it("cancels the body when the consumer stops early", async () => {
    let cancelled = false
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(event({ type: "start" })))
      },
      cancel() {
        cancelled = true
      },
    })
    for await (const _ of readUiChunks(new Response(body))) break
    await vi.waitFor(() => expect(cancelled).toBe(true))
  })

  it("yields nothing for an empty body", async () => {
    expect(await collect(new Response(null))).toEqual([])
  })
})
