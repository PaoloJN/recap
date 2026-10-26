import type { Icon } from "@phosphor-icons/react"
import { ClosedCaptioning, Coins, Key, LockSimple } from "@phosphor-icons/react"
import { usePanelNav } from "@/components/shell/NavigationContext"
import { largeButton, primaryButton, secondaryButton } from "@/components/summary/buttons"
import { cn } from "@/lib/utils"

const ROWS: { icon: Icon; title: string; note: string }[] = [
  { icon: Coins, title: "Pennies per summary", note: "A 10-minute video is a few thousand tokens" },
  { icon: LockSimple, title: "Stays on this device", note: "Sent only to the provider you pick" },
  {
    icon: ClosedCaptioning,
    title: "Transcript works without one",
    note: "Search, follow and jump are free",
  },
]

export function NoKeyGate({ verb }: { verb: "summarize videos" | "chat with videos" }) {
  const { setView, selectTab } = usePanelNav()
  return (
    <div className="flex flex-col gap-[20px] p-[20px] py-[28px]">
      <div className="flex flex-col gap-[12px]">
        <div className="flex size-[44px] items-center justify-center rounded-[12px] bg-secondary text-foreground">
          <Key size={22} aria-hidden />
        </div>
        <h2 className="text-[16px] leading-[22px] font-medium text-foreground">
          Add a key to {verb}
        </h2>
        <p className="text-[14px] leading-[21px] text-muted-foreground">
          This runs on your own API key. No account, no subscription — you pay OpenAI, Anthropic,
          Google or OpenRouter directly.
        </p>
      </div>
      <div className="divide-y divide-border overflow-hidden rounded-[12px] bg-card">
        {ROWS.map(({ icon: RowIcon, title, note }) => (
          <div key={title} className="flex items-center gap-[12px] px-[14px] py-[12px]">
            <RowIcon size={18} className="shrink-0 text-muted-foreground" aria-hidden />
            <div className="flex min-w-0 flex-col gap-[2px]">
              <span className="text-[14px] leading-[20px] text-foreground">{title}</span>
              <span className="text-[12px] leading-[16px] text-muted-foreground">{note}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-[8px]">
        <button
          type="button"
          className={cn(primaryButton, largeButton, "w-full")}
          onClick={() => setView("onboarding")}
        >
          Add API key
        </button>
        <button
          type="button"
          className={cn(secondaryButton, largeButton, "w-full")}
          onClick={() => selectTab("transcript")}
        >
          Open transcript
        </button>
      </div>
    </div>
  )
}
