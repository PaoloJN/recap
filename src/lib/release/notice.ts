import type { UpdateCheck } from "@/lib/storage"
import { isNewerVersion } from "./version"

/** The panel asks GitHub at most once per six hours. */
export const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

export function shouldCheckForUpdate(checkedAt: number, now: number): boolean {
  return now - checkedAt >= UPDATE_CHECK_INTERVAL_MS
}

/** Version to show, or null when there is nothing newer or that version was dismissed. */
export function visibleUpdateVersion(check: UpdateCheck, current: string): string | null {
  if (!check.latest || !isNewerVersion(check.latest, current)) return null
  if (check.dismissed === check.latest) return null
  return check.latest
}
