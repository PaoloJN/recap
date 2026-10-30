import { ArrowSquareOut } from "@phosphor-icons/react"
import { largeButton, primaryButton, secondaryButton } from "@/components/summary/buttons"
import { usePro } from "@/hooks/usePro"
import { cn } from "@/lib/utils"
import { GateLayout } from "./GateLayout"

/** Shown in place of a sign-in gate while the website's sign-in tab is open. */
export function SignInWaiting() {
  const { reopenSignIn, cancelSignIn } = usePro()
  return (
    <GateLayout
      icon={ArrowSquareOut}
      title="Finish signing in in the other tab"
      body="Recap will pick it up as soon as you're done."
    >
      <button
        type="button"
        className={cn(primaryButton, largeButton, "w-full")}
        onClick={() => void reopenSignIn()}
      >
        Open it again
      </button>
      <button
        type="button"
        className={cn(secondaryButton, largeButton, "w-full")}
        onClick={() => void cancelSignIn()}
      >
        Cancel
      </button>
    </GateLayout>
  )
}
