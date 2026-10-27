import { Hourglass } from "@phosphor-icons/react"
import { usePanelNav } from "@/components/shell/NavigationContext"
import { largeButton, secondaryButton } from "@/components/summary/buttons"
import { cn } from "@/lib/utils"
import { resetsLine } from "./access"
import { GateLayout } from "./GateLayout"

/** Recap Pro monthly limit reached (429 limit_reached). */
export function LimitGate({ resetsAt }: { resetsAt: string | null | undefined }) {
  const { setView } = usePanelNav()
  return (
    <GateLayout
      icon={Hourglass}
      title="Monthly limit reached"
      body={`${resetsLine(resetsAt)} Switch to your own key to keep going.`}
    >
      <button
        type="button"
        className={cn(secondaryButton, largeButton, "w-full")}
        onClick={() => setView("onboarding", { screen: "key" })}
      >
        Use my own key
      </button>
    </GateLayout>
  )
}
