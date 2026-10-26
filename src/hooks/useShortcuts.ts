import { useEffect, useRef } from "react"
import { isEditableTarget, matchShortcut, type ShortcutId } from "@/lib/shortcuts"

/** Global in-page shortcuts; while `enabled` is false keys pass through untouched. */
export function useShortcuts(enabled: boolean, handlers: Record<ShortcutId, () => void>) {
  const ref = useRef(handlers)
  ref.current = handlers
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!enabledRef.current) return
      // composedPath()[0] reaches inputs inside our shadow root.
      const target = e.composedPath()[0] ?? e.target
      if (isEditableTarget(target)) return
      const id = matchShortcut(e)
      if (!id) return
      e.preventDefault()
      e.stopPropagation()
      ref.current[id]()
    }
    document.addEventListener("keydown", onKeyDown, true)
    return () => document.removeEventListener("keydown", onKeyDown, true)
  }, [])
}
