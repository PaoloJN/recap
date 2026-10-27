import { useCallback } from "react"
import { usePanelNav } from "@/components/shell/NavigationContext"
import { useToast } from "@/components/shell/ToastContext"
import { usePro } from "@/hooks/usePro"
import { updateSettings } from "@/hooks/useSettings"

/**
 * "Continue with Google" for the welcome screen and the gates: signs in (or reuses a session
 * that already exists), switches the provider to Recap Pro and returns to the main view.
 * A cancelled window resets silently; a failure shows a toast.
 */
export function useProSignIn(): { signIn(): Promise<void>; signingIn: boolean } {
  const pro = usePro()
  const { setView } = usePanelNav()
  const toast = useToast()
  const { signedIn, signIn: proSignIn, signingIn } = pro

  const signIn = useCallback(async () => {
    if (!signedIn) {
      const result = await proSignIn()
      if (!result.ok) {
        if (result.reason === "failed") toast("Couldn't sign in. Try again.")
        return
      }
    }
    try {
      await updateSettings({ provider: "pro" })
    } catch (e) {
      console.error("Failed to switch to Recap Pro", e)
      toast("Couldn't sign in. Try again.")
      return
    }
    setView("main")
    toast("Signed in to Recap Pro")
  }, [signedIn, proSignIn, setView, toast])

  return { signIn, signingIn }
}
