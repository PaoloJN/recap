import { useCallback, useRef, useState } from "react"
import { checkKey } from "@/lib/key-check"
import type { KeyCheckResult } from "@/lib/port-protocol"
import type { ProviderId } from "@/lib/types"

export type KeyCheckStatus = "idle" | "checking" | "invalid" | "valid"

export interface KeyCheckState {
  status: KeyCheckStatus
  result: KeyCheckResult | null
  /** True after an attempt to check an empty key. */
  error: boolean
  check(provider: ProviderId, key: string): Promise<void>
  reset(): void
}

export function useKeyCheck(
  check: (provider: ProviderId, key: string) => Promise<KeyCheckResult> = checkKey,
): KeyCheckState {
  const [status, setStatus] = useState<KeyCheckStatus>("idle")
  const [result, setResult] = useState<KeyCheckResult | null>(null)
  const [error, setError] = useState(false)
  // Bumped by reset() so a stale in-flight check cannot overwrite a newer state.
  const run = useRef(0)

  const reset = useCallback(() => {
    run.current++
    setStatus("idle")
    setResult(null)
    setError(false)
  }, [])

  const start = useCallback(
    async (provider: ProviderId, key: string) => {
      if (!key.trim()) {
        setError(true)
        setStatus("idle")
        setResult(null)
        return
      }
      const id = ++run.current
      setError(false)
      setStatus("checking")
      let next: KeyCheckResult
      try {
        next = await check(provider, key.trim())
      } catch {
        next = { ok: false, status: null, message: "Couldn't reach the extension." }
      }
      if (id !== run.current) return
      setResult(next)
      setStatus(next.ok ? "valid" : "invalid")
    },
    [check],
  )

  return { status, result, error, check: start, reset }
}
