import { Clock, MagnifyingGlass, PaperPlaneRight, Play, Stop, X } from "@phosphor-icons/react"
import { type KeyboardEvent, type ReactNode, type RefObject, useLayoutEffect } from "react"
import { Textarea } from "@/components/ui/textarea"
import { usePlayer } from "@/hooks/usePlayer"
import { composerMaxPx } from "@/lib/layout/panel-layout"
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
  /** Research mode: every question is a web lookup until turned off. */
  research: boolean
  /** False when the current provider cannot search the web. */
  researchSupported: boolean
  onToggleResearch(): void
  busy: boolean
  onSend(): void
  onStop(): void
  onExplainMoment(): void
  modelPicker: ReactNode
  textareaRef: RefObject<HTMLTextAreaElement | null>
}

function ExplainMomentButton({ disabled, onClick }: { disabled: boolean; onClick(): void }) {
  const { ms } = usePlayer()
  return (
    <button
      type="button"
      data-testid="explain-moment"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-[28px] shrink-0 cursor-pointer items-center gap-[4px] rounded-[8px] bg-secondary px-[8px] text-[12px] font-medium text-foreground outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-50"
    >
      <Play weight="fill" className="size-[12px]" aria-hidden />
      Giảng {formatMs(ms)}
    </button>
  )
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
  research,
  researchSupported,
  onToggleResearch,
  busy,
  onSend,
  onStop,
  onExplainMoment,
  modelPicker,
  textareaRef,
}: ComposerProps) {
  const canSend = draft.trim() !== "" && !busy

  // Refit when `draft` commits. The height comes from scrollHeight, so the name is unused.
  // biome-ignore lint/correctness/useExhaustiveDependencies: refit after each draft commit
  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    const sizeField = () => {
      const card = el.closest("[data-recap-card]")
      el.style.setProperty("field-sizing", "fixed")
      const max = composerMaxPx(card instanceof HTMLElement ? card.clientHeight : 0)
      el.style.maxHeight = `${max}px`
      el.style.height = "auto"
      el.style.height = `${Math.min(el.scrollHeight, max)}px`
      el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden"
    }
    sizeField()
    const card = el.closest("[data-recap-card]")
    if (!card) return
    const observer = new ResizeObserver(sizeField)
    observer.observe(card)
    return () => observer.disconnect()
  }, [draft, textareaRef])

  // ⏎ sends, ⇧⏎ inserts a newline; while a reply streams Enter does nothing.
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return
    e.preventDefault()
    if (canSend) onSend()
  }

  return (
    <div className="recap-composer shrink-0 px-[12px] pt-[8px] pb-[12px]">
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
          rows={1}
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask anything about this video"
          aria-label="Ask anything about this video"
          className="field-sizing-fixed min-h-[40px] resize-none rounded-none border-0 bg-transparent p-0 text-[14px] leading-[20px] text-foreground shadow-none placeholder:text-subtle-foreground focus-visible:ring-0 md:text-[14px] dark:bg-transparent"
        />
        <div className="flex flex-wrap items-center gap-[6px]">
          <ExplainMomentButton disabled={busy} onClick={onExplainMoment} />
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
          <button
            type="button"
            aria-label="Tra thêm trên web"
            aria-pressed={research}
            title={
              researchSupported
                ? research
                  ? "Đang tra thêm trên web — bấm để tắt"
                  : "Tra thêm trên web"
                : "Provider này không hỗ trợ tra web"
            }
            disabled={!researchSupported}
            onClick={onToggleResearch}
            className={cn(
              ROUND,
              "disabled:cursor-default disabled:opacity-50",
              research
                ? "cursor-pointer bg-link-soft text-link ring-1 ring-link"
                : "cursor-pointer text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <MagnifyingGlass
              weight={research ? "bold" : "regular"}
              className="size-[16px]"
              aria-hidden
            />
          </button>
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
