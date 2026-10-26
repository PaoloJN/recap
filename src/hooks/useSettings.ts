import { useCallback, useMemo } from "react"
import { mergeSettings, type Settings, settingsItem } from "@/lib/storage"
import { useStorageItem } from "./useStorageItem"

export function useSettings(): [Settings | undefined, (patch: Partial<Settings>) => Promise<void>] {
  const [raw, setRaw] = useStorageItem(settingsItem)
  const settings = useMemo(() => (raw === undefined ? undefined : mergeSettings(raw)), [raw])
  const update = useCallback(
    (patch: Partial<Settings>) => setRaw({ ...mergeSettings(raw), ...patch }),
    [raw, setRaw],
  )
  return [settings, update]
}
