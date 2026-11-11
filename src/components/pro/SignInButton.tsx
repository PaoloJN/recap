import { CircleNotch } from "@phosphor-icons/react"
import { largeButton, primaryButton } from "@/components/summary/buttons"
import { cn } from "@/lib/utils"
import { useProSignIn } from "./useProSignIn"

/** Full-width primary "Sign in"; a spinner while the sign-in tab is being opened. */
export function SignInButton({ label = "Sign in" }: { label?: string }) {
  const { signIn, signingIn } = useProSignIn()
  return (
    <button
      type="button"
      aria-disabled={signingIn}
      onClick={() => {
        if (!signingIn) void signIn()
      }}
      className={cn(primaryButton, largeButton, "w-full")}
    >
      {signingIn ? <CircleNotch className="animate-spin" aria-hidden /> : null}
      {label}
    </button>
  )
}
