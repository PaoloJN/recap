import type { ReactNode } from "react"
import type { PanelTab } from "@/lib/types"
import { cn } from "@/lib/utils"
import { usePanelNav } from "./NavigationContext"

const TABS: { id: PanelTab; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "transcript", label: "Transcript" },
  { id: "chat", label: "Chat" },
]

export function TabRow({ right }: { right?: ReactNode }) {
  const { tab, selectTab } = usePanelNav()
  return (
    <div className="flex items-center gap-[8px] border-b pr-[10px] pb-[12px] pl-[16px]">
      {TABS.map(({ id, label }) => {
        const active = tab === id
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            className={cn(
              "h-[32px] cursor-pointer rounded-[8px] px-[12px] text-[14px] font-medium transition-colors duration-150 ease-out outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              active
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-foreground hover:bg-muted",
            )}
            onClick={() => selectTab(id)}
          >
            {label}
          </button>
        )
      })}
      <div className="flex-1" />
      {right}
    </div>
  )
}
