import { useEffect, useRef } from "react"
import { usePanelNav } from "@/components/shell/NavigationContext"
import { useToast } from "@/components/shell/ToastContext"
import { usePro } from "@/hooks/usePro"
import { updateSettings } from "@/hooks/useSettings"
import type { ProLinkPollResult } from "@/lib/port-protocol"
import { PRO_ENABLED } from "@/lib/pro/config"

export const LINK_POLL_MS = 1500

const SIGN_IN_FAILED = "Couldn't sign in. Try again."

/**
 * Drives the tab sign-in from the page.
 *
 * While `active` (a sign-in is pending), asks the background every 1.5 s whether the website
 * approved it, one request at a time. When the key arrives ("signed-in", or "done" if that came
 * first) it switches the provider to Recap Pro, returns to the main view and toasts, once per
 * sign-in. It keeps polling after "signed-in" so the background can close the sign-in tab on
 * "done", stops on "done", "expired" or "idle", and polls on through errors. An "idle" means the
 * background dropped the flow (a rejected code or key) unless we are now signed in.
 *
 * While not `active`, it probes once on mount and each time the page becomes visible, so a page
 * that didn't start the flow (reloaded, or opened by the website after the video tab closed) can
 * still find and finish it.
 */
export function useLinkPoll(active: boolean): void {
  const { pollLink, probeLink, signedIn } = usePro()
  const { setView } = usePanelNav()
  const toast = useToast()
  const latest = useRef({ pollLink, probeLink, signedIn, setView, toast })
  latest.current = { pollLink, probeLink, signedIn, setView, toast }
  // Probe on mount only, not each time polling ends: right after a cancel, the background may not
  // have dropped the flow yet, and a probe would bring the waiting state back.
  const mountProbed = useRef(false)

  useEffect(() => {
    let announced = false
    const announce = async () => {
      if (announced) return
      announced = true
      try {
        await updateSettings({ provider: "pro" })
      } catch (e) {
        console.error("Failed to switch to Recap Pro", e)
        latest.current.toast(SIGN_IN_FAILED)
        return
      }
      latest.current.setView("main")
      latest.current.toast("Signed in to Recap Pro")
    }

    if (!active) {
      if (!PRO_ENABLED) return
      // A probe answer of "pending" or "signed-in" turns `active` on and the poller takes over;
      // the next poll announces. Only a flow finished by the probe itself is announced here.
      let busy = false
      const probe = () => {
        if (busy || document.visibilityState !== "visible") return
        busy = true
        void latest.current
          .probeLink()
          .then((result) => {
            if (result?.state === "done") return announce()
          })
          .finally(() => {
            busy = false
          })
      }
      if (!mountProbed.current) {
        mountProbed.current = true
        probe()
      }
      document.addEventListener("visibilitychange", probe)
      return () => document.removeEventListener("visibilitychange", probe)
    }

    mountProbed.current = true
    let timer: ReturnType<typeof setInterval> | null = null
    let busy = false
    const stop = () => {
      if (timer !== null) clearInterval(timer)
      timer = null
    }

    // Handled even after cleanup: a terminal reply also ends `active`, often before it gets
    // here, and must still be announced. A reply made stale by a cancel or new start is null.
    const handle = async (result: ProLinkPollResult | null) => {
      switch (result?.state) {
        case "signed-in":
          await announce()
          return
        case "done":
          stop()
          await announce()
          return
        case "expired":
          stop()
          latest.current.toast("Sign-in timed out. Try again.")
          return
        case "idle":
          stop()
          // Signed in already: another page finished this flow.
          if (!latest.current.signedIn) latest.current.toast(SIGN_IN_FAILED)
          return
        default:
        // "pending", "error" or a stale reply: poll again.
      }
    }

    timer = setInterval(() => {
      if (busy) return
      busy = true
      void latest.current
        .pollLink()
        .then(handle)
        .finally(() => {
          busy = false
        })
    }, LINK_POLL_MS)

    return stop
  }, [active])
}
