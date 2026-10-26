import {
  CaretDown,
  CaretUp,
  Copy,
  CrosshairSimple,
  MagnifyingGlass,
  X,
} from "@phosphor-icons/react"
import type { KeyboardEvent, Ref } from "react"
import { cn } from "@/lib/utils"

export interface TranscriptToolbarProps {
  query: string
  onQuery(value: string): void
  matchLabel: string
  onNext(): void
  onPrev(): void
  onClear(): void
  follow: boolean
  onToggleFollow(): void
  onCopy(): void
  inputRef: Ref<HTMLInputElement>
}

const CLUSTER_BUTTON =
  "flex size-[28px] cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"

export function TranscriptToolbar({
  query,
  onQuery,
  matchLabel,
  onNext,
  onPrev,
  onClear,
  follow,
  onToggleFollow,
  onCopy,
  inputRef,
}: TranscriptToolbarProps) {
  const hasQuery = query.trim() !== ""

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      if (e.shiftKey) onPrev()
      else onNext()
    } else if (e.key === "Escape" && query !== "") {
      e.preventDefault()
      e.stopPropagation()
      onClear()
    }
  }

  return (
    <div className="flex items-center gap-[8px] px-[16px] pt-[12px] pb-[8px]">
      <div className="relative min-w-0 flex-1">
        <MagnifyingGlass
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-[12px] size-[16px] -translate-y-1/2 text-muted-foreground"
        />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search transcript"
          aria-label="Search transcript"
          className={cn(
            "h-[36px] w-full rounded-[8px] border border-input bg-background pl-[36px] text-[14px] text-foreground transition-colors duration-150 outline-none placeholder:text-muted-foreground focus:border-ring",
            hasQuery ? "pr-[120px]" : "pr-[12px]",
          )}
        />
        {hasQuery ? (
          <div className="absolute top-1/2 right-[4px] flex -translate-y-1/2 items-center">
            <span className="px-[4px] font-mono text-[11px] text-muted-foreground">
              {matchLabel}
            </span>
            <button
              type="button"
              aria-label="Previous match"
              className={CLUSTER_BUTTON}
              onClick={onPrev}
            >
              <CaretUp className="size-[14px]" />
            </button>
            <button
              type="button"
              aria-label="Next match"
              className={CLUSTER_BUTTON}
              onClick={onNext}
            >
              <CaretDown className="size-[14px]" />
            </button>
            <button
              type="button"
              aria-label="Clear search"
              className={CLUSTER_BUTTON}
              onClick={onClear}
            >
              <X className="size-[14px]" />
            </button>
          </div>
        ) : null}
      </div>
      <button
        type="button"
        aria-pressed={follow}
        title={follow ? "Following playback" : "Follow playback"}
        onClick={onToggleFollow}
        className={cn(
          "flex h-[36px] shrink-0 cursor-pointer items-center gap-[6px] rounded-[8px] px-[12px] text-[13px] font-medium transition-colors duration-150 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          follow
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-foreground hover:bg-muted",
        )}
      >
        <CrosshairSimple className="size-[16px]" />
        <span>Follow</span>
      </button>
      <button
        type="button"
        aria-label="Copy transcript"
        title="Copy transcript"
        onClick={onCopy}
        className="flex size-[36px] shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <Copy className="size-[18px]" />
      </button>
    </div>
  )
}
