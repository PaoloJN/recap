import { describe, expect, it } from "vitest"
import { CHATGPT_USAGE_LIMIT } from "./errors"
import { readResponsesSse } from "./sse"

function streamOf(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text))
      controller.close()
    },
  })
}

describe("readResponsesSse", () => {
  it("returns text only after response.completed", async () => {
    const sse = [
      'data: {"type":"response.output_text.delta","delta":"Xin "}',
      "",
      'data: {"type":"response.output_text.delta","delta":"chào"}',
      "",
      'data: {"type":"response.completed","response":{"usage":{"input_tokens":3,"output_tokens":2}}}',
      "",
      "",
    ].join("\n")
    const parts: string[] = []
    const tokens = await readResponsesSse(streamOf(sse), (delta) => parts.push(delta))
    expect(parts.join("")).toBe("Xin chào")
    expect(tokens).toBe(5)
  })

  it("maps the subscription limit and ignores a stream that never completes", async () => {
    const failed = `data: {"type":"response.failed","response":{"error":{"code":"subscription_sharing_usage_limit_exceeded"}}}\n\n`
    await expect(readResponsesSse(streamOf(failed), () => {})).rejects.toThrow(CHATGPT_USAGE_LIMIT)
    const dropped = 'data: {"type":"response.output_text.delta","delta":"Hi"}\n\n'
    await expect(readResponsesSse(streamOf(dropped), () => {})).rejects.toThrow(/không hoàn tất/)
  })
})
