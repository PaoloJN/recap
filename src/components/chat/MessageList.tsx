import type { ChatStatus, UIMessage } from "ai"
import type { ChatMessageMetadata } from "@/lib/types"
import { AssistantMessage } from "./AssistantMessage"
import { UserBubble } from "./UserBubble"

export function messageText(m: UIMessage): string {
  return m.parts.map((p) => (p.type === "text" ? p.text : "")).join("")
}

export function messageMeta(m: UIMessage): ChatMessageMetadata {
  return (m.metadata ?? {}) as ChatMessageMetadata
}

export interface MessageListProps {
  messages: UIMessage[]
  status: ChatStatus
  error: Error | undefined
  onCopy(text: string): void
  onRegenerate(): void
  onFeedback(id: string): void
  onRetry(): void
}

export function MessageList({
  messages,
  status,
  error,
  onCopy,
  onRegenerate,
  onFeedback,
  onRetry,
}: MessageListProps) {
  const busy = status === "submitted" || status === "streaming"
  const last = messages.at(-1)
  const lastAssistantId = messages.findLast((m) => m.role === "assistant")?.id
  // Until the first chunk arrives there is no assistant message yet; show its dots.
  const pending = busy && last?.role !== "assistant"

  return (
    <div className="flex flex-col gap-[20px]">
      {messages.map((m) => {
        const meta = messageMeta(m)
        const text = messageText(m)
        if (m.role === "user") {
          return <UserBubble key={m.id} text={text} at={meta.at} quote={meta.quote} />
        }
        if (m.role !== "assistant") return null
        return (
          <AssistantMessage
            key={m.id}
            text={text}
            streaming={busy && m.id === last?.id}
            stopped={meta.stopped === true}
            isLast={m.id === lastAssistantId}
            busy={busy}
            feedback={meta.feedback === "up"}
            onCopy={() => onCopy(text)}
            onRegenerate={onRegenerate}
            onFeedback={() => onFeedback(m.id)}
          />
        )
      })}
      {pending ? (
        <AssistantMessage
          text=""
          streaming
          stopped={false}
          isLast
          busy
          feedback={false}
          onCopy={() => {}}
          onRegenerate={() => {}}
          onFeedback={() => {}}
        />
      ) : null}
      {error && !busy ? (
        <div className="flex items-center gap-[8px] rounded-[12px] bg-danger-soft p-[12px]">
          <span
            role="alert"
            className="min-w-0 flex-1 text-[13px] leading-[19px] break-words text-foreground"
          >
            {error.message}
          </span>
          <button
            type="button"
            onClick={onRetry}
            className="h-[28px] shrink-0 cursor-pointer rounded-[8px] px-[10px] text-[13px] font-medium text-foreground transition-colors duration-150 outline-none hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Retry
          </button>
        </div>
      ) : null}
    </div>
  )
}
