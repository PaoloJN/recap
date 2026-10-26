import { ArrowLeft } from "@phosphor-icons/react"
import type { ReactNode } from "react"

export interface SubHeaderProps {
  title: string
  onBack(): void
  right?: ReactNode
}

/** Replaces the main header in Settings and the BYOK connect view: ← back, title, right slot. */
export function SubHeader({ title, onBack, right }: SubHeaderProps) {
  return (
    <div className="flex items-center gap-[8px] border-b border-border py-[12px] pr-[16px] pl-[8px]">
      <button
        type="button"
        aria-label="Back"
        title="Back"
        onClick={onBack}
        className="flex size-[36px] shrink-0 cursor-pointer items-center justify-center rounded-full text-foreground transition-colors duration-150 ease-out outline-none hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <ArrowLeft size={18} aria-hidden />
      </button>
      <h2 className="min-w-0 flex-1 truncate text-[16px] leading-[22px] font-medium text-foreground">
        {title}
      </h2>
      {right}
    </div>
  )
}
