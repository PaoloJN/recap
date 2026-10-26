import { useMemo } from "react"
import { mergeSettings, type Settings, settingsItem } from "@/lib/storage"
import { useStorageItem } from "./useStorageItem"

// Writes are chained so each one reads the value the previous one wrote: two patches in
// the same tick both persist instead of the second clobbering the first.
let writes: Promise<void> = Promise.resolve()

export function updateSettings(patch: Partial<Settings>): Promise<void> {
  const run = writes.then(async () => {
    const current = mergeSettings(await settingsItem.getValue())
    await settingsItem.setValue({ ...current, ...patch })
  })
  writes = run.catch(() => {})
  return run
}

export function useSettings(): [Settings | undefined, (patch: Partial<Settings>) => Promise<void>] {
  const [raw] = useStorageItem(settingsItem)
  const settings = useMemo(() => (raw === undefined ? undefined : mergeSettings(raw)), [raw])
  return [settings, updateSettings]
}
