import type { UIMessage } from "ai"
import type { ChatMessageMetadata } from "@/lib/types"
import { messageMeta } from "./MessageList"

/** Merges `patch` into the message's metadata, dropping keys set to undefined. */
export function withMetadata(m: UIMessage, patch: Partial<ChatMessageMetadata>): UIMessage {
  const metadata: ChatMessageMetadata = { ...messageMeta(m), ...patch }
  for (const key of Object.keys(metadata) as (keyof ChatMessageMetadata)[]) {
    if (metadata[key] === undefined) delete metadata[key]
  }
  return { ...m, metadata }
}

/**
 * Marks the trailing assistant reply "Stopped.". When Stop came before the first chunk (the
 * thread ends on the user turn), appends an empty stopped reply so the turn can be regenerated.
 */
export function markStopped(messages: UIMessage[], newId: () => string): UIMessage[] {
  const last = messages.at(-1)
  if (!last) return messages
  if (last.role === "assistant") {
    return [...messages.slice(0, -1), withMetadata(last, { stopped: true })]
  }
  return [...messages, { id: newId(), role: "assistant", parts: [], metadata: { stopped: true } }]
}

/** A send only clears the composer when what was sent is the composer's text. */
export function shouldClearDraft(sent: string, draft: string): boolean {
  return sent === draft.trim()
}
