import { SignOut } from "@phosphor-icons/react"
import { usePanelNav } from "@/components/shell/NavigationContext"
import { largeButton, secondaryButton } from "@/components/summary/buttons"
import { usePro } from "@/hooks/usePro"
import { cn } from "@/lib/utils"
import { GateLayout } from "./GateLayout"
import { SignInButton } from "./SignInButton"
import { SignInWaiting } from "./SignInWaiting"

/** Shown after a 401: the device key was revoked or expired. Never signs in by itself. */
export function SignedOutGate() {
  const { setView } = usePanelNav()
  const { linkPending } = usePro()
  if (linkPending) return <SignInWaiting />
  return (
    <GateLayout
      icon={SignOut}
      title="Signed out of Recap Pro"
      body="Sign in again to keep going, or switch to your own key."
    >
      <SignInButton label="Sign in again" />
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
