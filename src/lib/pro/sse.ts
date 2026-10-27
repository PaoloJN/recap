import { parseJsonEventStream, type UIMessageChunk, uiMessageChunkSchema } from "ai"

/**
 * Reads a Recap Pro SSE body (AI SDK UI message stream) as UI message chunks, using the
 * SDK's own parser (eventsource-parser + schema validation; `[DONE]` is dropped).
 * Events that aren't valid chunks are skipped with a warning rather than ending the stream.
 */
export async function* readUiChunks(res: Response): AsyncIterable<UIMessageChunk> {
  if (!res.body) return
  const reader = parseJsonEventStream({
    stream: res.body,
    schema: uiMessageChunkSchema,
  }).getReader()
  let finished = false
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        finished = true
        return
      }
      if (value.success) yield value.value
      else console.warn("[recap] skipped a malformed Recap Pro stream event", value.error)
    }
  } finally {
    // A consumer that stops early (break/return) cancels the underlying body.
    if (!finished) await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
