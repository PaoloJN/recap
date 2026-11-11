import { Sparkle } from "@phosphor-icons/react"
import { useCallback, useEffect, useRef } from "react"
import { usePanelNav } from "@/components/shell/NavigationContext"
import { useToast } from "@/components/shell/ToastContext"
import { largeButton, primaryButton, secondaryButton } from "@/components/summary/buttons"
import { usePricing } from "@/hooks/usePricing"
import { usePro } from "@/hooks/usePro"
import { proUrl } from "@/lib/pro/config"
import { connectPath, currentReturnUrl } from "@/lib/pro/return-url"
import type { MeResponse } from "@/lib/pro/types"
import { cn } from "@/lib/utils"
import { GateLayout } from "./GateLayout"

export const UPGRADE_POLL_MS = 5_000
export const UPGRADE_POLL_WINDOW_MS = 2 * 60_000

// Set when a poll starts on this page, so "You're on Recap Pro" shows once, and only after the
// upgrade page was opened here (shared by the Summary and Chat gates).
let upgradeToastPending = false

/** Test hook: forget a pending upgrade toast. */
export function resetUpgradeToastForTests(): void {
  upgradeToastPending = false
}

/**
 * After the upgrade page opens, refetches the account every 5 s for 2 minutes of visible time,
 * and right away when the tab becomes visible again while an upgrade is pending. One poller per hook, however often `start` is called (a repeat click only extends the
 * window). When the plan changes from trial/expired to "pro" while mounted (from a poll, or
 * usePro's own refresh after a checkout that took longer), polling stops and `onPro(toast)` runs;
 * `toast` is true once per page, for the first gate to see it after a poll was started.
 */
export function useUpgradePoll(
  refresh: () => Promise<void>,
  plan: MeResponse["plan"] | undefined,
  onPro: (toast: boolean) => void,
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
    upgradeToastPending = true
    deadline.current = Date.now() + UPGRADE_POLL_WINDOW_MS
    if (timer.current !== null) return
    timer.current = setInterval(() => {
      // Paused while the YouTube tab is in the background (the user is in checkout): only
      // visible time counts against the window, so polling resumes on return.
      if (document.visibilityState !== "visible") {
        deadline.current += UPGRADE_POLL_MS
        return
      }
      if (Date.now() > deadline.current) {
        stop()
        // Ended without an upgrade: forget the toast; a later click starts over.
        upgradeToastPending = false
        return
      }
      void latest.current.refresh()
    }, UPGRADE_POLL_MS)
  }, [stop])

  useEffect(() => stop, [stop])

  // Coming back from checkout: refetch right away, whatever usePro's staleness rule says.
  useEffect(() => {
    const onVisibility = () => {
      if (upgradeToastPending && document.visibilityState === "visible") {
        void latest.current.refresh()
      }
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => document.removeEventListener("visibilitychange", onVisibility)
  }, [])

  // Only a change to "pro" seen while mounted counts. A cached "pro" (or one that first loads
  // here) may be stale, e.g. a lapsed subscription behind a real 402: refetch instead of clearing.
  const prevPlan = useRef<MeResponse["plan"] | undefined>(undefined)
  const mounted = useRef(false)
  useEffect(() => {
    const before = prevPlan.current
    const first = !mounted.current
    mounted.current = true
    prevPlan.current = plan
    if (plan !== "pro") return
    if (first || before === undefined) {
      void latest.current.refresh()
      return
    }
    if (before === "pro") return
    stop()
    const toast = upgradeToastPending
    upgradeToastPending = false
    latest.current.onPro(toast)
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
  const { me, refresh } = usePro()
  const pricing = usePricing()
  const { setView } = usePanelNav()
  const toast = useToast()
  const startPolling = useUpgradePoll(refresh, me?.plan, (showToast) => {
    if (showToast) toast("You're on Recap Pro")
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
          window.open(proUrl(connectPath(currentReturnUrl())), "_blank", "noopener")
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
