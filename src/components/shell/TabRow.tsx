import type { ReactNode } from "react"
import type { PanelTab } from "@/lib/types"
import { cn } from "@/lib/utils"
import { usePanelNav } from "./NavigationContext"

const TABS: { id: PanelTab; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "transcript", label: "Transcript" },
  { id: "chat", label: "Chat" },
  { id: "diagram", label: "Sơ đồ" },
]

export function TabRow({ right }: { right?: ReactNode }) {
  const { tab, selectTab } = usePanelNav()
  return (
    <div className="flex items-center gap-[6px] border-b pr-[8px] pb-[12px] pl-[12px]">
      <div className="flex min-w-0 flex-1 items-center gap-[6px] overflow-x-auto">
        {TABS.map(({ id, label }) => {
          const active = tab === id
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              className={cn(
                "h-[32px] shrink-0 cursor-pointer rounded-[8px] px-[10px] text-[13px] font-medium transition-colors duration-150 ease-out outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
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
      </div>
      {right}
    </div>
  )
}
