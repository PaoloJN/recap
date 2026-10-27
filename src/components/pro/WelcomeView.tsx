import { ClosedCaptioning } from "@phosphor-icons/react"
import { Logo } from "@/components/shell/Logo"
import { usePanelNav } from "@/components/shell/NavigationContext"
import { largeButton, secondaryButton } from "@/components/summary/buttons"
import { usePro } from "@/hooks/usePro"
import { trialPriceLine } from "@/lib/pro/plan-copy"
import { cn } from "@/lib/utils"
import { GoogleButton } from "./GoogleButton"

/** First screen of the onboarding view in builds with Recap Pro; the key screen is step two. */
export function WelcomeView() {
  const { setView } = usePanelNav()
  const { pricing } = usePro()
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="flex flex-col gap-[20px] px-[16px] py-[28px]">
        <div className="flex flex-col gap-[12px]">
          <div className="flex items-center gap-[10px] text-foreground">
            <Logo size={28} />
            <span className="text-[20px] leading-[26px] font-medium">Recap</span>
          </div>
          <p className="text-[14px] leading-[21px] text-muted-foreground">
            Summaries, transcript and chat for any YouTube video.
          </p>
        </div>
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
          Use my own API key
        </button>
        <div className="flex items-center gap-[8px] text-[12px] leading-[16px] text-muted-foreground">
          <ClosedCaptioning size={16} className="shrink-0 text-subtle-foreground" aria-hidden />
          Transcript works without signing in
        </div>
      </div>
    </div>
  )
}
