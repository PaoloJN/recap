import { ChatCircle, Copy } from "@phosphor-icons/react"
import { memo } from "react"
import { splitByQuery } from "@/components/transcript/highlight"
import type { TranscriptSegment } from "@/lib/types"
import { cn } from "@/lib/utils"

export interface TranscriptRowProps {
  row: TranscriptSegment
  index: number
  active: boolean
  isMatchCurrent: boolean
  query: string
  time: string
  /** Display text (fillers already removed when the setting is on). */
  text: string
  onSeek(index: number): void
  onAsk(index: number): void
  onCopy(index: number): void
}

const PILL_BUTTON =
  "flex h-[28px] cursor-pointer items-center justify-center rounded-[6px] transition-colors duration-150 outline-none hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/50"

export const TranscriptRow = memo(function TranscriptRow({
  index,
  active,
  isMatchCurrent,
  query,
  time,
  text,
  onSeek,
  onAsk,
  onCopy,
}: TranscriptRowProps) {
  return (
    <div
      data-active={active ? "true" : undefined}
      data-match={isMatchCurrent ? "true" : undefined}
      className={cn(
        "group relative rounded-[8px] transition-colors duration-150",
        active ? "bg-secondary" : "hover:bg-card",
      )}
    >
      <button
        type="button"
        aria-current={active ? "true" : undefined}
        onClick={() => onSeek(index)}
        className="grid w-full cursor-pointer grid-cols-[52px_minmax(0,1fr)] gap-[8px] rounded-[8px] p-[8px] text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span
          className={cn(
            "font-mono text-[12px] leading-[var(--leading-body)]",
            active ? "text-link" : "text-muted-foreground",
          )}
        >
          {time}
        </span>
        <span
          className={cn(
            "text-body text-pretty",
            active ? "text-foreground" : "text-card-foreground",
          )}
        >
          {splitByQuery(text, query).map((part, i) =>
            part.match ? (
              <mark
                // biome-ignore lint/suspicious/noArrayIndexKey: parts are positional and static per render
                key={i}
                className={cn(
                  "rounded-[3px]",
                  isMatchCurrent ? "bg-warning text-[#0f0f0f]" : "bg-warning-soft text-inherit",
                )}
              >
                {part.text}
              </mark>
            ) : (
              // biome-ignore lint/suspicious/noArrayIndexKey: parts are positional and static per render
              <span key={i}>{part.text}</span>
            ),
          )}
        </span>
      </button>
      <div className="absolute top-[4px] right-[6px] hidden gap-[2px] rounded-[8px] border bg-popover p-[2px] shadow-pop group-focus-within:flex group-hover:flex">
        <button
          type="button"
          className={cn(PILL_BUTTON, "gap-[4px] px-[8px] text-[12px] font-medium text-foreground")}
          onClick={(e) => {
            e.stopPropagation()
            onAsk(index)
          }}
        >
          <ChatCircle className="size-[14px]" />
          <span>Ask</span>
        </button>
        <button
          type="button"
          aria-label="Copy line"
          title="Copy line"
          className={cn(PILL_BUTTON, "w-[28px] text-muted-foreground hover:text-foreground")}
          onClick={(e) => {
            e.stopPropagation()
            onCopy(index)
          }}
        >
          <Copy className="size-[14px]" />
        </button>
      </div>
    </div>
  )
})
