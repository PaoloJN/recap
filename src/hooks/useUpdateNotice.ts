import { useEffect, useRef, useState } from "react"
import { browser } from "wxt/browser"
import { useStorageItem } from "@/hooks/useStorageItem"
import { fetchLatestReleaseVersion } from "@/lib/release/fetch"
import { shouldCheckForUpdate, visibleUpdateVersion } from "@/lib/release/notice"
import { updateCheckItem } from "@/lib/storage"

function installedVersion(): string {
  try {
    return browser.runtime.getManifest().version
  } catch {
    return "0.0.0"
  }
}

/** On panel open, look up the latest release at most once every six hours. */
export function useUpdateNotice(open: boolean): { version: string | null; dismiss(): void } {
  const [check, setCheck] = useStorageItem(updateCheckItem)
  const [version, setVersion] = useState<string | null>(null)
  const startedFor = useRef<number | null>(null)

  useEffect(() => {
    if (!check) {
      setVersion(null)
      return
    }
    setVersion(visibleUpdateVersion(check, installedVersion()))
    if (!open) {
      startedFor.current = null
      return
    }
    if (startedFor.current === check.checkedAt) return
    if (!shouldCheckForUpdate(check.checkedAt, Date.now())) return
    startedFor.current = check.checkedAt
    const snapshot = check
    void (async () => {
      let latest = snapshot.latest
      try {
        const found = await fetchLatestReleaseVersion()
        if (found) latest = found
      } catch {
        // A failed lookup still starts the six-hour wait.
      }
      const stored = await updateCheckItem.getValue()
      await setCheck({
        checkedAt: Date.now(),
        latest,
        dismissed: stored.dismissed,
      })
    })()
  }, [open, check, setCheck])

  const dismiss = () => {
    if (!check?.latest) return
    void setCheck({ ...check, dismissed: check.latest })
  }

  return { version, dismiss }
}
