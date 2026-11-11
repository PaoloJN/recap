import type { ModelMessage } from "ai"

export interface ProLimits {
  chars: number
  messages: number
  /** UTF-8 bytes of the JSON request body (`{kind, system, messages}`). */
  bytes: number
}

/**
 * Server request limits (recap-website `/api/v1/stream`). The server rejects bodies over 512 KB;
 * the byte budget leaves headroom below that.
 */
export const PRO_LIMITS: ProLimits = { chars: 160_000, messages: 40, bytes: 480_000 }

const encoder = new TextEncoder()
const utf8Bytes = (text: string): number => encoder.encode(text).length

function messageChars(message: ModelMessage): number {
  if (typeof message.content === "string") return message.content.length
  let n = 0
  for (const part of message.content) {
    n += part.type === "text" ? part.text.length : JSON.stringify(part).length
  }
  return n
}

/**
 * Drops the oldest chat turns until the request fits the Pro limits (message count, characters,
 * and the UTF-8 size of the JSON body, which CJK text fills three times faster than characters). The result always starts
 * with a user message and keeps the latest user message. The system prompt is never cut and no
 * text is truncated: if even the smallest allowed tail is too big it is returned as is, and the
 * server answers 413.
 *
 * Precondition: `messages` ends with a user message (every summary and chat request does). With no
 * user message at all there is nothing safe to keep, so the input is returned unchanged.
 */
export function trimForPro(
  system: string,
  messages: ModelMessage[],
  limits: ProLimits = PRO_LIMITS,
  kind: "summary" | "chat" = "chat",
): ModelMessage[] {
  const lastUser = messages.findLastIndex((m) => m.role === "user")
  if (lastUser === -1) return messages

  // suffix[i] = chars of messages[i..]; suffixBytes[i] = UTF-8 bytes of their JSON, each followed
  // by a "," separator (one too many, dropped below).
  const suffix: number[] = new Array(messages.length + 1).fill(0)
  const suffixBytes: number[] = new Array(messages.length + 1).fill(0)
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i] as ModelMessage
    suffix[i] = (suffix[i + 1] ?? 0) + messageChars(message)
    suffixBytes[i] = (suffixBytes[i + 1] ?? 0) + utf8Bytes(JSON.stringify(message)) + 1
  }
  // JSON.stringify({kind, system, messages}) is this envelope around the joined messages.
  const envelope = utf8Bytes(JSON.stringify({ kind, system, messages: [] }))

  // Each user message starts a turn; try the oldest start first so we keep as much as fits.
  for (let start = 0; start < lastUser; start++) {
    if (messages[start]?.role !== "user") continue
    const fits =
      messages.length - start <= limits.messages &&
      system.length + (suffix[start] ?? 0) <= limits.chars &&
      envelope + (suffixBytes[start] ?? 0) - 1 <= limits.bytes
    if (fits) return start === 0 ? messages : messages.slice(start)
  }
  return lastUser === 0 ? messages : messages.slice(lastUser)
}
