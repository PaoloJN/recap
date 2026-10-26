import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface SettingsRowProps {
  title: ReactNode
  note?: ReactNode
  control?: ReactNode
  /** Puts the control under the title (full width), e.g. a textarea. */
  stacked?: boolean
  className?: string
}

export function SettingsRow({ title, note, control, stacked, className }: SettingsRowProps) {
  return (
    <div
      className={cn(
        "flex gap-[12px] px-[14px] py-[12px]",
        stacked ? "flex-col gap-[8px]" : "items-center",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
        <span className="text-[14px] leading-[20px] text-foreground">{title}</span>
        {note ? (
          <span className="text-[12px] leading-[16px] text-muted-foreground">{note}</span>
        ) : null}
      </div>
      {control ? <div className={stacked ? "w-full" : "shrink-0"}>{control}</div> : null}
    </div>
  )
}
