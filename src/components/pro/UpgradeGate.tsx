import { Sparkle } from "@phosphor-icons/react"
import { useCallback, useEffect, useRef } from "react"
import { usePanelNav } from "@/components/shell/NavigationContext"
import { useToast } from "@/components/shell/ToastContext"
import { largeButton, primaryButton, secondaryButton } from "@/components/summary/buttons"
import { usePro } from "@/hooks/usePro"
import { proUrl } from "@/lib/pro/config"
import type { MeResponse } from "@/lib/pro/types"
import { cn } from "@/lib/utils"
import { GateLayout } from "./GateLayout"

export const UPGRADE_POLL_MS = 5_000
export const UPGRADE_POLL_WINDOW_MS = 2 * 60_000

/**
 * After the upgrade page opens, refetches the account every 5 s for 2 minutes while this tab is
 * visible, and calls `onPro` once when the plan turns "pro". One poller per hook, however often
 * `start` is called (a repeat click only extends the window).
 */
export function useUpgradePoll(
  refresh: () => Promise<void>,
  plan: MeResponse["plan"] | undefined,
  onPro: () => void,
): () => void {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const deadline = useRef(0)
  const latest = useRef({ refresh, onPro })
  latest.current = { refresh, onPro }

  const stop = useCallback(() => {
    if (timer.current !== null) clearInterval(timer.current)
    timer.current = null
  }, [])

  const start = useCallback(() => {
    deadline.current = Date.now() + UPGRADE_POLL_WINDOW_MS
    if (timer.current !== null) return
    timer.current = setInterval(() => {
      if (Date.now() > deadline.current) {
        stop()
        return
      }
      // Paused while the YouTube tab is in the background; usePro refreshes on return anyway.
      if (document.visibilityState !== "visible") return
      void latest.current.refresh()
    }, UPGRADE_POLL_MS)
  }, [stop])

  useEffect(() => stop, [stop])

  useEffect(() => {
    if (plan !== "pro" || timer.current === null) return
    stop()
    latest.current.onPro()
  }, [plan, stop])

  return start
}

/** Recap Pro trial used up (402 upgrade_required). */
export function UpgradeGate({
  kind,
  onUpgraded,
}: {
  kind: "summary" | "chat"
  /** Called once the plan turns "pro", to clear the error behind this gate. */
  onUpgraded(): void
}) {
  const { me, pricing, refresh } = usePro()
  const { setView } = usePanelNav()
  const toast = useToast()
  const startPolling = useUpgradePoll(refresh, me?.plan, () => {
    toast("You're on Recap Pro")
    onUpgraded()
  })

  const price = pricing ? `${pricing.monthly.display} a month` : "a small monthly plan"
  return (
    <GateLayout
      icon={Sparkle}
      title={
        kind === "summary" ? "Your free summaries are used up" : "Your free messages are used up"
      }
      body={`Recap Pro is ${price} for 300 summaries and 1,000 chat messages. Cancel anytime.`}
    >
      <button
        type="button"
        className={cn(primaryButton, largeButton, "w-full")}
        onClick={() => {
          window.open(proUrl("/account?upgrade=monthly"), "_blank", "noopener")
          startPolling()
        }}
      >
        Get Recap Pro
      </button>
      <button
        type="button"
        className={cn(secondaryButton, largeButton, "w-full")}
        onClick={() => setView("onboarding", { screen: "key" })}
      >
        Use my own key instead
      </button>
    </GateLayout>
  )
}
