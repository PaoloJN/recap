import { useEffect, useRef } from "react"
import type { ProErrorCode } from "@/lib/pro/types"

/**
 * Signing in again clears an error left by a 401 ("unauthorized"), so its signed-out gate goes
 * away. Only a signed-out → signed-in transition counts.
 */
export function useClearOnSignIn(
  signedIn: boolean,
  code: ProErrorCode | null | undefined,
  clear: () => void,
): void {
  const was = useRef(signedIn)
  const latest = useRef(clear)
  latest.current = clear
  useEffect(() => {
    const before = was.current
    was.current = signedIn
    if (!before && signedIn && code === "unauthorized") latest.current()
  }, [signedIn, code])
}
