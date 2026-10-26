import { Clock, PaperPlaneRight, Stop, X } from "@phosphor-icons/react"
import type { KeyboardEvent, ReactNode, RefObject } from "react"
import { Textarea } from "@/components/ui/textarea"
import { formatMs } from "@/lib/timestamps"
import { cn } from "@/lib/utils"
import type { ChatQuote } from "./ChatDraftContext"
import { LiveTime } from "./LiveTime"

export interface ComposerProps {
  draft: string
  onDraft(v: string): void
  quote: ChatQuote | null
  onClearQuote(): void
  attachTime: boolean
  onToggleAttach(): void
  busy: boolean
  onSend(): void
  onStop(): void
  modelPicker: ReactNode
  textareaRef: RefObject<HTMLTextAreaElement | null>
}

const GHOST =
  "flex h-[28px] shrink-0 cursor-pointer items-center gap-[4px] rounded-[6px] px-[8px] text-[12px] font-medium text-muted-foreground transition-colors duration-150 outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
const ROUND =
  "flex size-[32px] shrink-0 items-center justify-center rounded-full transition-colors duration-150 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

export function Composer({
  draft,
  onDraft,
  quote,
  onClearQuote,
  attachTime,
  onToggleAttach,
  busy,
  onSend,
  onStop,
  modelPicker,
  textareaRef,
}: ComposerProps) {
  const canSend = draft.trim() !== "" && !busy

  // ⏎ sends, ⇧⏎ inserts a newline; while a reply streams Enter does nothing.
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return
    e.preventDefault()
    if (canSend) onSend()
  }

  return (
    <div className="shrink-0 px-[12px] pt-[8px] pb-[12px]">
      <div className="flex flex-col gap-[8px] rounded-[12px] border border-input bg-background p-[10px]">
        {quote ? (
          <div className="flex items-start gap-[8px] rounded-[8px] bg-secondary py-[6px] pr-[6px] pl-[10px]">
            <span className="font-mono text-[11px] leading-[18px] text-link">
              {formatMs(quote.seconds * 1000)}
            </span>
            <span className="line-clamp-2 min-w-0 flex-1 text-[12px] leading-[18px] text-card-foreground">
              {quote.text}
            </span>
            <button
              type="button"
              aria-label="Remove quote"
              onClick={onClearQuote}
              className="flex size-[20px] shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <X className="size-[12px]" aria-hidden />
            </button>
          </div>
        ) : null}
        <Textarea
          ref={textareaRef}
          rows={2}
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask anything about this video"
          aria-label="Ask anything about this video"
          className="min-h-[40px] max-h-[120px] resize-none rounded-none border-0 bg-transparent p-0 text-[14px] leading-[20px] text-foreground shadow-none placeholder:text-subtle-foreground focus-visible:ring-0 md:text-[14px] dark:bg-transparent"
        />
        <div className="flex items-center gap-[6px]">
          {modelPicker}
          {attachTime ? (
            <button
              type="button"
              aria-label="Remove timestamp"
              onClick={onToggleAttach}
              className="flex h-[28px] shrink-0 cursor-pointer items-center gap-[4px] rounded-[6px] bg-link-soft px-[8px] font-mono text-[11px] font-medium text-link outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <Clock className="size-[13px]" aria-hidden />
              <span>
                at <LiveTime />
              </span>
              <X className="size-[10px]" aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              title="Ask about the current moment"
              onClick={onToggleAttach}
              className={GHOST}
            >
              <Clock className="size-[13px]" aria-hidden />
              <span>Current moment</span>
            </button>
          )}
          <div className="flex-1" />
          {busy ? (
            <button
              type="button"
              aria-label="Stop"
              onClick={onStop}
              className={cn(ROUND, "cursor-pointer bg-secondary text-foreground hover:bg-muted")}
            >
              <Stop weight="fill" className="size-[14px]" aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              aria-label="Send"
              disabled={!canSend}
              onClick={onSend}
              className={cn(
                ROUND,
                canSend
                  ? "cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-secondary text-subtle-foreground",
              )}
            >
              <PaperPlaneRight className="size-[16px]" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
