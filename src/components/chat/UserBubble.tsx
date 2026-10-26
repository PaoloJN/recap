import { Clock } from "@phosphor-icons/react"
import { formatMs } from "@/lib/timestamps"
import type { ChatQuote } from "./ChatDraftContext"

export interface UserBubbleProps {
  text: string
  /** Seconds into the video the question was asked at ("Current moment"). */
  at?: number
  quote?: ChatQuote
}

export function UserBubble({ text, at, quote }: UserBubbleProps) {
  return (
    <div className="flex flex-col items-end gap-[6px]">
      {quote ? (
        <div className="flex max-w-[85%] gap-[8px] rounded-[8px] border bg-card px-[10px] py-[6px]">
          <span className="font-mono text-[11px] leading-[18px] text-link">
            {formatMs(quote.seconds * 1000)}
          </span>
          <span className="text-[12px] leading-[18px] text-muted-foreground">{quote.text}</span>
        </div>
      ) : null}
      {at !== undefined ? (
        <span className="flex items-center gap-[4px] font-mono text-[11px] text-subtle-foreground">
          <Clock className="size-[12px]" aria-hidden />
          <span>at {formatMs(at * 1000)}</span>
        </span>
      ) : null}
      <div className="max-w-[85%] rounded-[12px_12px_4px_12px] bg-secondary px-[14px] py-[8px] text-body break-words whitespace-pre-wrap text-foreground">
        {text}
      </div>
    </div>
  )
}
