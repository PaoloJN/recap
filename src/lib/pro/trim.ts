import type { ModelMessage } from "ai"

export interface ProLimits {
  chars: number
  messages: number
}

/** Server request limits (recap-website `/api/v1/stream`). */
export const PRO_LIMITS: ProLimits = { chars: 160_000, messages: 40 }

function messageChars(message: ModelMessage): number {
  if (typeof message.content === "string") return message.content.length
  let n = 0
  for (const part of message.content) {
    n += part.type === "text" ? part.text.length : JSON.stringify(part).length
  }
  return n
}

/**
 * Drops the oldest chat turns until the request fits the Pro limits. The result always starts
 * with a user message and keeps the latest user message. The system prompt is never cut and no
 * text is truncated: if even the smallest allowed tail is too big it is returned as is, and the
 * server answers 413.
 */
export function trimForPro(
  system: string,
  messages: ModelMessage[],
  limits: ProLimits = PRO_LIMITS,
): ModelMessage[] {
  const lastUser = messages.findLastIndex((m) => m.role === "user")
  if (lastUser === -1) return messages

  // suffix[i] = chars of messages[i..]
  const suffix: number[] = new Array(messages.length + 1).fill(0)
  for (let i = messages.length - 1; i >= 0; i--) {
    suffix[i] = (suffix[i + 1] ?? 0) + messageChars(messages[i] as ModelMessage)
  }

  // Each user message starts a turn; try the oldest start first so we keep as much as fits.
  for (let start = 0; start < lastUser; start++) {
    if (messages[start]?.role !== "user") continue
    const fits =
      messages.length - start <= limits.messages &&
      system.length + (suffix[start] ?? 0) <= limits.chars
    if (fits) return start === 0 ? messages : messages.slice(start)
  }
  return lastUser === 0 ? messages : messages.slice(lastUser)
}
