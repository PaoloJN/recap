import { useEffect, useRef } from "react"
import { isEditableTarget, matchShortcut, type ShortcutId } from "@/lib/shortcuts"

export function useShortcuts(handlers: Record<ShortcutId, () => void>) {
  const ref = useRef(handlers)
  ref.current = handlers
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
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
