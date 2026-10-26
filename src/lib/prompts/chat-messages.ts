import type { UIMessage } from "ai"
import { formatMs } from "../timestamps"
import type { ChatMessageMetadata } from "../types"

function expand(m: UIMessage): UIMessage {
  if (m.role !== "user" || typeof m.metadata !== "object" || m.metadata === null) return m
  const { quote, at } = m.metadata as ChatMessageMetadata
  if (!quote && typeof at !== "number") return m
  const idx = m.parts.findIndex((p) => p.type === "text")
  if (idx === -1) return m
  const parts = m.parts.map((p, i) => {
    if (i !== idx || p.type !== "text") return p
    let text = quote ? `> [${formatMs(quote.seconds * 1000)}] ${quote.text}\n\n${p.text}` : p.text
    if (typeof at === "number") text += `\n\n(asked at ${formatMs(at * 1000)})`
    return { ...p, text }
  })
  return { ...m, parts }
}

function isEmptyReply(m: UIMessage): boolean {
  return m.role === "assistant" && !m.parts.some((p) => p.type === "text" && p.text.trim() !== "")
}

/**
 * Expands user quote/at metadata into the text and drops empty assistant replies (a reply stopped
 * before its first token), which providers reject.
 */
export function expandUserMessages(messages: UIMessage[]): UIMessage[] {
  return messages.filter((m) => !isEmptyReply(m)).map(expand)
}
