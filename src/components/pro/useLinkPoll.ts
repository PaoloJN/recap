import { useEffect, useRef } from "react"
import { usePanelNav } from "@/components/shell/NavigationContext"
import { useToast } from "@/components/shell/ToastContext"
import { usePro } from "@/hooks/usePro"
import { updateSettings } from "@/hooks/useSettings"

export const LINK_POLL_MS = 1500

/**
 * While `active` (a sign-in tab is pending), asks the background every 1.5 s whether the website
 * approved it, one request at a time. When the key arrives ("signed-in", or "done" if that came
 * first) it switches the provider to Recap Pro, returns to the main view and toasts, once per
 * sign-in. It keeps polling after "signed-in" so the background can close the sign-in tab on
 * "done", stops on "done", "expired" or "idle", and polls on through errors.
 */
export function useLinkPoll(active: boolean): void {
  const { pollLink } = usePro()
  const { setView } = usePanelNav()
  const toast = useToast()
  const latest = useRef({ pollLink, setView, toast })
  latest.current = { pollLink, setView, toast }

  useEffect(() => {
    if (!active) return
    let timer: ReturnType<typeof setInterval> | null = null
    let busy = false
    let announced = false

    const stop = () => {
      if (timer !== null) clearInterval(timer)
      timer = null
    }

    const announce = async () => {
      if (announced) return
      announced = true
      try {
        await updateSettings({ provider: "pro" })
      } catch (e) {
        console.error("Failed to switch to Recap Pro", e)
        latest.current.toast("Couldn't sign in. Try again.")
        return
      }
      latest.current.setView("main")
      latest.current.toast("Signed in to Recap Pro")
    }

    timer = setInterval(() => {
      if (busy) return
      busy = true
      void latest.current
        .pollLink()
        .then(async ({ state }) => {
          // Handled even after cleanup: a terminal reply also ends `active`, often before it
          // reaches here, and must still be announced.
          switch (state) {
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
              return
            default:
            // "pending" or "error": poll again.
          }
        })
        .finally(() => {
          busy = false
        })
    }, LINK_POLL_MS)

    return stop
  }, [active])
}
