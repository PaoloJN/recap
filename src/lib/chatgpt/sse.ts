import { friendlyChatGptError } from "./errors"

export type ResponsesEvent =
  | { kind: "delta"; delta: string }
  | { kind: "failed"; code?: string }
  | { kind: "completed"; tokens: number }
  | { kind: "ignore" }

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null
}

function errorCode(json: Record<string, unknown>): string | undefined {
  const response = asRecord(json.response)
  const nested = asRecord(response?.error) ?? asRecord(json.error)
  const code = nested?.code ?? json.code
  return typeof code === "string" && code ? code : undefined
}

function usageTokens(json: Record<string, unknown>): number {
  const response = asRecord(json.response) ?? json
  const usage = asRecord(response.usage)
  if (!usage) return 0
  const input = usage.input_tokens
  const output = usage.output_tokens
  const a = typeof input === "number" && Number.isFinite(input) ? input : 0
  const b = typeof output === "number" && Number.isFinite(output) ? output : 0
  return Math.max(0, a) + Math.max(0, b)
}

export function interpretResponsesPayload(json: unknown): ResponsesEvent {
  const record = asRecord(json)
  if (!record || typeof record.type !== "string") return { kind: "ignore" }
  if (record.type === "response.output_text.delta") {
    return typeof record.delta === "string" && record.delta
      ? { kind: "delta", delta: record.delta }
      : { kind: "ignore" }
  }
  if (record.type === "response.failed" || record.type === "error") {
    return { kind: "failed", code: errorCode(record) }
  }
  if (record.type === "response.completed") {
    return { kind: "completed", tokens: usageTokens(record) }
  }
  return { kind: "ignore" }
}

/** Split a text/event-stream buffer into data payloads, keeping an incomplete tail. */
export function drainSse(buffer: string): { data: string[]; rest: string } {
  const parts = buffer.replace(/\r\n/g, "\n").split("\n\n")
  const rest = parts.pop() ?? ""
  const data: string[] = []
  for (const block of parts) {
    const payload = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("")
    if (payload) data.push(payload)
  }
  return { data, rest }
}

/** Yield text deltas. Succeeds only after `response.completed`. */
export async function readResponsesSse(
  stream: ReadableStream<Uint8Array>,
  onDelta: (delta: string) => void,
): Promise<number> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buf = ""
  let completed = false
  let tokens = 0
  const apply = (payload: string) => {
    if (!payload || payload === "[DONE]") return
    let json: unknown
    try {
      json = JSON.parse(payload)
    } catch {
      return
    }
    const event = interpretResponsesPayload(json)
    if (event.kind === "delta") onDelta(event.delta)
    else if (event.kind === "failed") throw new Error(friendlyChatGptError(event.code))
    else if (event.kind === "completed") {
      completed = true
      tokens = event.tokens
    }
  }
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) {
        buf += decoder.decode()
        break
      }
      if (value) buf += decoder.decode(value, { stream: true })
      const drained = drainSse(buf)
      buf = drained.rest
      for (const payload of drained.data) apply(payload)
    }
    const tail = drainSse(`${buf}\n\n`)
    for (const payload of tail.data) apply(payload)
  } finally {
    reader.releaseLock()
  }
  if (!completed) throw new Error(friendlyChatGptError(undefined))
  return tokens
}
