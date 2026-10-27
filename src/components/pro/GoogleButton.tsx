import { CircleNotch } from "@phosphor-icons/react"
import { largeButton, primaryButton } from "@/components/summary/buttons"
import { cn } from "@/lib/utils"
import { GoogleMark } from "./GoogleMark"
import { useProSignIn } from "./useProSignIn"

/** Full-width primary "Continue with Google"; shows "Waiting for Google…" while the window is open. */
export function GoogleButton({ label = "Continue with Google" }: { label?: string }) {
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
      {signingIn ? (
        <>
          <CircleNotch className="animate-spin" aria-hidden />
          Waiting for Google…
        </>
      ) : (
        <>
          <GoogleMark size={18} />
          {label}
        </>
      )}
    </button>
  )
}
