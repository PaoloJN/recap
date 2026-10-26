import { ChatCircle, Copy, Lightbulb, ThumbsDown, ThumbsUp } from "@phosphor-icons/react"
import { IconButton } from "@/components/shell/IconButton"
import { usePlayer } from "@/hooks/usePlayer"
import { useSeek } from "@/hooks/useSeek"
import type { ParsedSummary } from "@/lib/summary/parse"
import { formatMs } from "@/lib/timestamps"
import type { SummaryStyle } from "@/lib/types"
import { cn } from "@/lib/utils"
import { secondaryButton } from "./buttons"

export interface SummaryDoneProps {
  parsed: ParsedSummary
  style: SummaryStyle
  feedback: "up" | "down" | undefined
  onFeedback(f: "up" | "down"): void
  onCopy(): void
  onFollowUp(): void
  /** `Model · Style · Language`. */
  meta: string
}

const LABEL = "text-[13px] leading-[18px] font-medium text-muted-foreground"

/** The only part that follows playback, so only it subscribes to the player. */
function MomentList({ moments }: { moments: ParsedSummary["moments"] }) {
  const { ms } = usePlayer()
  const seek = useSeek()
  let current = -1
  moments.forEach((m, i) => {
    if (m.seconds * 1000 <= ms) current = i
  })
  return (
    <div className="-mx-[8px] flex flex-col">
      {moments.map((m, i) => {
        const on = i === current
        return (
          <button
            // biome-ignore lint/suspicious/noArrayIndexKey: moments can repeat a timestamp
            key={i}
            type="button"
            aria-current={on ? "true" : undefined}
            className={cn(
              "grid cursor-pointer grid-cols-[44px_minmax(0,1fr)] items-baseline gap-[8px] rounded-[8px] p-[8px] text-left transition-colors duration-150 ease-out outline-none hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/50",
              on && "bg-card",
            )}
            onClick={() => seek(m.seconds)}
          >
            <span className="font-mono text-[12px] font-medium text-link">
              {formatMs(m.seconds * 1000)}
            </span>
            <span
              className={cn(
                "text-body text-pretty",
                on ? "text-foreground" : "text-card-foreground",
              )}
            >
              {m.text}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function SummaryDone({
  parsed,
  style,
  feedback,
  onFeedback,
  onCopy,
  onFollowUp,
  meta,
}: SummaryDoneProps) {
  const showLead = style !== "moments" && parsed.lead !== ""
  const showMoments = style !== "tldr" && parsed.moments.length > 0
  const showNotes = style === "detailed" && parsed.notes.length > 0
  const showPlain = style === "detailed" && parsed.plain !== ""

  return (
    <div className="flex flex-col gap-[24px]">
      {showLead ? (
        <p className="text-lead whitespace-pre-line text-pretty text-foreground">{parsed.lead}</p>
      ) : null}
      {showMoments ? (
        <section className="flex flex-col gap-[4px]">
          <div className="flex items-baseline justify-between pb-[4px]">
            <h3 className={LABEL}>Key moments</h3>
            <span className="text-[12px] leading-[16px] text-subtle-foreground">Click to jump</span>
          </div>
          <MomentList moments={parsed.moments} />
        </section>
      ) : null}
      {showNotes ? (
        <section className="flex flex-col gap-[8px]">
          <h3 className={LABEL}>Notes</h3>
          <ul className="flex flex-col gap-[8px]">
            {parsed.notes.map((note, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: notes are positional
              <li key={i} className="grid grid-cols-[14px_minmax(0,1fr)] gap-[4px]">
                <span
                  aria-hidden
                  className="mt-[calc((var(--leading-body)_-_4px)/2)] size-[4px] rounded-full bg-subtle-foreground"
                />
                <span className="text-body text-pretty text-card-foreground">{note}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {showPlain ? (
        <section className="flex flex-col gap-[6px] rounded-[12px] bg-secondary px-[14px] py-[12px]">
          <h3 className="flex items-center gap-[6px] text-[13px] leading-[18px] font-medium text-foreground">
            <Lightbulb className="size-[16px] text-muted-foreground" aria-hidden />
            In plain terms
          </h3>
          <p className="text-body whitespace-pre-line text-pretty text-card-foreground">
            {parsed.plain}
          </p>
        </section>
      ) : null}
      <footer className="flex flex-col gap-[8px] border-t pt-[12px]">
        <div className="flex items-center gap-[2px]">
          <span className="mr-[4px] text-[12px] leading-[16px] text-muted-foreground">Useful?</span>
          <IconButton
            label="Useful"
            aria-pressed={feedback === "up"}
            className={cn("[&_svg]:size-[16px]", feedback === "up" && "text-foreground")}
            onClick={() => onFeedback("up")}
          >
            <ThumbsUp weight={feedback === "up" ? "fill" : "regular"} />
          </IconButton>
          <IconButton
            label="Not useful"
            aria-pressed={feedback === "down"}
            className={cn("[&_svg]:size-[16px]", feedback === "down" && "text-foreground")}
            onClick={() => onFeedback("down")}
          >
            <ThumbsDown weight={feedback === "down" ? "fill" : "regular"} />
          </IconButton>
          <IconButton label="Copy as Markdown" className="[&_svg]:size-[16px]" onClick={onCopy}>
            <Copy />
          </IconButton>
          <div className="flex-1" />
          <button
            type="button"
            className={cn(secondaryButton, "h-[32px] gap-[6px] px-[12px] text-[13px]")}
            onClick={onFollowUp}
          >
            <ChatCircle aria-hidden />
            Ask a follow-up
          </button>
        </div>
        <span className="text-[11px] leading-[16px] text-subtle-foreground">{meta}</span>
      </footer>
    </div>
  )
}
