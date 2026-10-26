import type { UIMessage } from "ai"
import type { ChatStore } from "./storage"
import { formatMs } from "./timestamps"
import type { ChatMessageMetadata, VideoMetadata } from "./types"

const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`

function messageText(m: UIMessage): string {
  return m.parts.flatMap((p) => (p.type === "text" ? [p.text] : [])).join("\n\n")
}

function formatMessage(m: UIMessage): string {
  const text = messageText(m)
  if (m.role === "user") {
    const quote = (m.metadata as ChatMessageMetadata | undefined)?.quote
    const head = quote ? `> [${formatMs(quote.seconds * 1000)}] ${quote.text}\n` : ""
    return `${head}**You:** ${text}`
  }
  return `**YouTube AI:** ${text}`
}

function formatMessages(messages: UIMessage[]): string {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map(formatMessage)
    .join("\n\n")
}

export function exportVideoMarkdown(
  meta: VideoMetadata,
  summaryText: string | undefined,
  messages: UIMessage[] | undefined,
): string {
  const sections = [`# ${meta.title}`, `${watchUrl(meta.videoId)}\nChannel: ${meta.author}`]
  if (summaryText?.trim()) sections.push(`## Summary\n\n${summaryText}`)
  if (messages && messages.length > 0) sections.push(`## Chat\n\n${formatMessages(messages)}`)
  return sections.join("\n\n")
}

export function exportAllChats(store: ChatStore): string {
  const sections = ["# YouTube AI chats"]
  const entries = Object.entries(store).sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
  for (const [videoId, chat] of entries) {
    sections.push(
      `## ${chat.title ?? videoId}\n\n${watchUrl(videoId)}\n\n${formatMessages(chat.messages)}`,
    )
  }
  return sections.join("\n\n")
}

export function slugify(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "")
  return slug || "video"
}
