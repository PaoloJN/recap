import { useEffect, useRef } from "react"
import type { ProErrorCode } from "@/lib/pro/types"
import { gateFor } from "./access"

/**
 * An upgrade, limit or signed-out error means the server sees the account differently from the
 * cached snapshot: refetch it once per such error so the gates work from current data.
 */
export function useRefreshOnGateError(
  error: unknown,
  code: ProErrorCode | null | undefined,
  refresh: () => Promise<void>,
): void {
  const latest = useRef(refresh)
  latest.current = refresh
  useEffect(() => {
    if (error && gateFor(code ?? undefined) !== null) void latest.current()
  }, [error, code])
}
