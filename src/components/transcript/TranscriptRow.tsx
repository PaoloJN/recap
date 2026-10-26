import { forwardRef } from "react"
import { splitByQuery } from "@/components/transcript/highlight"
import { formatMs } from "@/lib/timestamps"
import type { TranscriptSegment } from "@/lib/types"
import { cn } from "@/lib/utils"

export interface TranscriptRowProps {
  segment: TranscriptSegment
  query: string
  active: boolean
  onSeek(seconds: number): void
}

export const TranscriptRow = forwardRef<HTMLButtonElement, TranscriptRowProps>(
  function TranscriptRow({ segment, query, active, onSeek }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        aria-current={active ? "true" : undefined}
        onClick={() => onSeek(segment.startMs / 1000)}
        className={cn(
          "flex w-full gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
          active && "bg-accent",
        )}
      >
        <span className="mt-0.5 shrink-0 font-mono text-xs text-muted-foreground">
          {formatMs(segment.startMs)}
        </span>
        <span>
          {splitByQuery(segment.text, query).map((part, i) =>
            part.match ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: parts are positional and static per render
              <mark key={i} className="rounded-sm bg-primary/20 text-inherit">
                {part.text}
              </mark>
            ) : (
              // biome-ignore lint/suspicious/noArrayIndexKey: parts are positional and static per render
              <span key={i}>{part.text}</span>
            ),
          )}
        </span>
      </button>
    )
  },
)
