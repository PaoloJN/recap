import { useCallback, useEffect, useState } from "react"
import type { WxtStorageItem } from "wxt/utils/storage"

export function useStorageItem<T>(
  item: WxtStorageItem<T, Record<string, unknown>>,
): [T | undefined, (v: T) => Promise<void>] {
  const [value, setLocal] = useState<T | undefined>(undefined)

  useEffect(() => {
    let active = true
    item.getValue().then((v) => {
      if (active) setLocal(v)
    })
    const unwatch = item.watch((v) => {
      if (active) setLocal(v)
    })
    return () => {
      active = false
      unwatch()
    }
  }, [item])

  const setValue = useCallback((v: T) => item.setValue(v), [item])
  return [value, setValue]
}
