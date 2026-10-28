import { ClosedCaptioning, Gift, SignIn, Sparkle } from "@phosphor-icons/react"
import { usePanelNav } from "@/components/shell/NavigationContext"
import { largeButton, secondaryButton } from "@/components/summary/buttons"
import { usePricing } from "@/hooks/usePricing"
import { trialPriceLine } from "@/lib/pro/plan-copy"
import { cn } from "@/lib/utils"
import { GateLayout, type GateRow } from "./GateLayout"
import { GoogleButton } from "./GoogleButton"

const ROWS: GateRow[] = [
  { icon: Gift, title: "20 free summaries" },
  { icon: Sparkle, title: "No key, no setup" },
  { icon: ClosedCaptioning, title: "Transcript works without it" },
]

/** No access to Summary/Chat in a build with Recap Pro: sign in, or bring your own key. */
export function AccessGate({ verb }: { verb: "summarize videos" | "chat with videos" }) {
  const { setView, selectTab } = usePanelNav()
  const pricing = usePricing()
  return (
    <GateLayout icon={SignIn} title={`Sign in to ${verb}`} rows={ROWS}>
      <div className="flex flex-col gap-[8px]">
        <GoogleButton />
        <p className="text-center text-[12px] leading-[16px] text-muted-foreground">
          {trialPriceLine(pricing)}
        </p>
      </div>
      <button
        type="button"
        className={cn(secondaryButton, largeButton, "w-full")}
        onClick={() => setView("onboarding", { screen: "key" })}
      >
        Use my own key
      </button>
      <button
        type="button"
        className="h-[32px] cursor-pointer self-center rounded-[8px] px-[10px] text-[13px] font-medium text-muted-foreground transition-colors duration-150 outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        onClick={() => selectTab("transcript")}
      >
        Open transcript
      </button>
    </GateLayout>
  )
}
