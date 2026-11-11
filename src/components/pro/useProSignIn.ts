import { useCallback, useState } from "react"
import { usePanelNav } from "@/components/shell/NavigationContext"
import { useToast } from "@/components/shell/ToastContext"
import { usePro } from "@/hooks/usePro"
import { updateSettings } from "@/hooks/useSettings"
import { currentReturnUrl } from "@/lib/pro/return-url"

/**
 * "Sign in" for the gates. Signed out, it opens the website's sign-in tab, coming back to this
 * video afterwards (a failure shows a toast). Signed in, it switches the provider to Recap Pro
 * and returns to the main view.
 */
export function useProSignIn(): { signIn(): Promise<void>; signingIn: boolean } {
  const pro = usePro()
  const { setView } = usePanelNav()
  const toast = useToast()
  const { signedIn, startSignIn } = pro
  const [signingIn, setSigningIn] = useState(false)

  const signIn = useCallback(async () => {
    if (!signedIn) {
      setSigningIn(true)
      try {
        const result = await startSignIn(currentReturnUrl())
        if (!result.ok) toast(result.message)
      } finally {
        setSigningIn(false)
      }
      return
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
  }, [signedIn, startSignIn, setView, toast])

  return { signIn, signingIn }
}
