import { Hourglass } from "@phosphor-icons/react"
import { useEffect, useRef } from "react"
import { usePanelNav } from "@/components/shell/NavigationContext"
import { largeButton, secondaryButton } from "@/components/summary/buttons"
import { usePro } from "@/hooks/usePro"
import { cn } from "@/lib/utils"
import { resetsLine } from "./access"
import { GateLayout } from "./GateLayout"

/**
 * Calls `onCleared` when the account changes in a way that lifts the limit: the plan changes, or
 * the usage count for `kind` goes down (the month reset). The first account load only records.
 */
export function useLimitLifted(kind: "summary" | "chat", onCleared: () => void): void {
  const { me } = usePro()
  const plan = me?.plan
  const used = me === null ? undefined : kind === "summary" ? me.usage.summaries : me.usage.chats
  const prev = useRef({ plan, used })
  const latest = useRef(onCleared)
  latest.current = onCleared
  useEffect(() => {
    const before = prev.current
    prev.current = { plan, used }
    if (plan === undefined || before.plan === undefined) return
    const usageDropped = used !== undefined && before.used !== undefined && used < before.used
    if (plan !== before.plan || usageDropped) latest.current()
  }, [plan, used])
}

/** Recap Pro monthly limit reached (429 limit_reached). */
export function LimitGate({
  kind,
  resetsAt,
  onCleared,
}: {
  kind: "summary" | "chat"
  resetsAt: string | null | undefined
  /** Called when the limit no longer applies, to clear the error behind this gate. */
  onCleared(): void
}) {
  const { setView } = usePanelNav()
  useLimitLifted(kind, onCleared)
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
