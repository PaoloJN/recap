import { ArrowClockwise, Copy, ThumbsUp } from "@phosphor-icons/react"
import { Markdown } from "@/components/markdown/Markdown"
import { IconButton } from "@/components/shell/IconButton"
import { Logo } from "@/components/shell/Logo"

export interface AssistantMessageProps {
  text: string
  streaming: boolean
  stopped: boolean
  isLast: boolean
  /** A reply is being generated somewhere in the thread; regenerate/feedback wait for it. */
  busy: boolean
  feedback: boolean
  onCopy(): void
  onRegenerate(): void
  onFeedback(): void
}

const ACTION = "size-[30px] [&_svg]:size-[15px]"

function Dots() {
  return (
    <div className="flex h-[21px] items-center gap-[4px]" role="status" aria-label="Thinking">
      {[0, 0.15, 0.3].map((delay) => (
        <span
          key={delay}
          className="size-[6px] rounded-full bg-muted-foreground"
          style={{ animation: `yt-pulse 1s ${delay}s infinite cubic-bezier(0.2,0,0,1)` }}
        />
      ))}
    </div>
  )
}

export function AssistantMessage({
  text,
  streaming,
  stopped,
  isLast,
  busy,
  feedback,
  onCopy,
  onRegenerate,
  onFeedback,
}: AssistantMessageProps) {
  return (
    <div className="grid grid-cols-[24px_minmax(0,1fr)] gap-[10px]">
      <div className="flex size-[24px] items-center justify-center rounded-[6px] bg-secondary text-foreground">
        <Logo size={11} />
      </div>
      <div className="flex min-w-0 flex-col gap-[8px] pt-[2px]">
        {streaming && !text ? (
          <Dots />
        ) : (
          <Markdown caret={streaming} className="text-body text-pretty text-card-foreground">
            {text}
          </Markdown>
        )}
        {stopped ? <span className="text-[12px] text-subtle-foreground">Stopped.</span> : null}
        {streaming ? null : (
          <div className="-ml-[8px] flex">
            <IconButton label="Copy" className={ACTION} onClick={onCopy}>
              <Copy />
            </IconButton>
            {isLast ? (
              <IconButton
                label="Regenerate"
                className={ACTION}
                disabled={busy}
                onClick={onRegenerate}
              >
                <ArrowClockwise />
              </IconButton>
            ) : null}
            <IconButton
              label="Good answer"
              aria-pressed={feedback}
              className={ACTION}
              disabled={busy}
              onClick={onFeedback}
            >
              <ThumbsUp weight={feedback ? "fill" : "regular"} />
            </IconButton>
          </div>
        )}
      </div>
    </div>
  )
}
