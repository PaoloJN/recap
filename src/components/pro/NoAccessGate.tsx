import { NoKeyGate } from "@/components/onboarding/NoKeyGate"
import { PRO_ENABLED } from "@/lib/pro/config"
import { AccessGate } from "./AccessGate"
import { SignedOutGate } from "./SignedOutGate"

/**
 * What Summary and Chat show without access. A build without Recap Pro shows today's NoKeyGate;
 * with Pro, the sign-in gate, or the signed-out gate after the session was lost.
 */
export function NoAccessGate({
  verb,
  signedOut,
}: {
  verb: "summarize videos" | "chat with videos"
  signedOut: boolean
}) {
  if (!PRO_ENABLED) return <NoKeyGate verb={verb} />
  return signedOut ? <SignedOutGate /> : <AccessGate verb={verb} />
}
