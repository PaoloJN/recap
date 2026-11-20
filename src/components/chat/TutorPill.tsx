import { CaretDown } from "@phosphor-icons/react"
import { type ReactNode, useEffect, useId, useRef, useState } from "react"
import {
  TUTOR_LEVEL_LABELS,
  TUTOR_LEVELS,
  TUTOR_MODE_LABELS,
  TUTOR_MODES,
  type TutorLevel,
  type TutorMode,
} from "@/lib/tutor/types"
import { cn } from "@/lib/utils"

const MODE_NOTES: Record<TutorMode, string> = {
  qa: "Trả lời thẳng, rồi một câu vì sao đáng nhớ.",
  explain: "Giảng khái niệm và một ví dụ để dùng được.",
  socratic: "AI hỏi ngược để bạn tự nghĩ ra.",
}

const LEVEL_NOTES: Record<TutorLevel, string> = {
  basic: "Giải thích từ đầu, ít thuật ngữ.",
  engineer: "Đủ sâu để áp dụng vào việc đang làm.",
  expert: "Đi vào đánh đổi, edge case và quyết định.",
}

export function TutorPill({
  mode,
  level,
  onChange,
}: {
  mode: TutorMode
  level: TutorLevel
  onChange(next: { mode: TutorMode; level: TutorLevel }): void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const dialogId = useId()

  useEffect(() => {
    if (!open) return
    dialogRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      buttonRef.current?.focus()
    }
    const onPointer = (event: PointerEvent) => {
      const root = rootRef.current
      if (!root) return
      if (event.composedPath().includes(root)) return
      setOpen(false)
    }
    document.addEventListener("keydown", onKey, true)
    document.addEventListener("pointerdown", onPointer)
    return () => {
      document.removeEventListener("keydown", onKey, true)
      document.removeEventListener("pointerdown", onPointer)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        data-testid="tutor-pill"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={dialogId}
        className="inline-flex h-[28px] cursor-pointer items-center gap-[4px] rounded-full bg-secondary px-[10px] text-[12px] font-medium text-foreground outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
        onClick={() => setOpen((value) => !value)}
      >
        <span>
          {TUTOR_MODE_LABELS[mode]} · {TUTOR_LEVEL_LABELS[level]}
        </span>
        <CaretDown className="size-[12px]" aria-hidden />
      </button>
      {open ? (
        <div
          ref={dialogRef}
          id={dialogId}
          role="dialog"
          tabIndex={-1}
          aria-label="Chế độ và trình độ"
          data-testid="tutor-popover"
          className="absolute top-[calc(100%+4px)] left-0 z-20 flex w-[280px] flex-col gap-[10px] rounded-[12px] border bg-background p-[10px] shadow-sm outline-none"
        >
          <OptionGroup label="Chế độ">
            {TUTOR_MODES.map((id) => (
              <Option
                key={id}
                label={TUTOR_MODE_LABELS[id]}
                note={MODE_NOTES[id]}
                selected={id === mode}
                onPick={() => onChange({ mode: id, level })}
              />
            ))}
          </OptionGroup>
          <OptionGroup label="Trình độ">
            {TUTOR_LEVELS.map((id) => (
              <Option
                key={id}
                label={TUTOR_LEVEL_LABELS[id]}
                note={LEVEL_NOTES[id]}
                selected={id === level}
                onPick={() => onChange({ mode, level: id })}
              />
            ))}
          </OptionGroup>
        </div>
      ) : null}
    </div>
  )
}

function OptionGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-[4px]">
      <p className="px-[6px] text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      {children}
    </div>
  )
}

function Option({
  label,
  note,
  selected,
  onPick,
}: {
  label: string
  note: string
  selected: boolean
  onPick(): void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "cursor-pointer rounded-[8px] px-[8px] py-[6px] text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        selected ? "bg-secondary" : "hover:bg-secondary/70",
      )}
      onClick={onPick}
    >
      <span className="block text-[13px] leading-[18px] font-medium text-foreground">{label}</span>
      <span className="block text-[12px] leading-[16px] text-muted-foreground">{note}</span>
    </button>
  )
}
