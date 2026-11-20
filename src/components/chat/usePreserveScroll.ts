import { type RefObject, useEffect } from "react"

const STICK_PX = 40

/**
 * Keeps the message under the top of the scroller in place when the card changes width.
 * Near the bottom, new content and resizes stay pinned instead.
 */
export function usePreserveScroll(
  scrollRef: RefObject<HTMLDivElement | null>,
  pinnedRef: RefObject<boolean>,
) {
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let anchor: { node: HTMLElement; delta: number } | null = null

    const pin = () => {
      pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_PX
    }
    const snapshot = () => {
      pin()
      if (pinnedRef.current) {
        anchor = null
        return
      }
      const top = el.getBoundingClientRect().top
      anchor = null
      for (const node of el.querySelectorAll<HTMLElement>("[data-msg]")) {
        const rect = node.getBoundingClientRect()
        if (rect.bottom > top + 1) {
          anchor = { node, delta: rect.top - top }
          return
        }
      }
    }
    const restore = () => {
      if (pinnedRef.current) {
        el.scrollTop = el.scrollHeight
        return
      }
      if (anchor) {
        const drift =
          anchor.node.getBoundingClientRect().top - el.getBoundingClientRect().top - anchor.delta
        if (Math.abs(drift) > 0.5) el.scrollTop += drift
      }
      snapshot()
    }

    const observer = new ResizeObserver(restore)
    observer.observe(el)
    el.addEventListener("scroll", snapshot, { passive: true })
    return () => {
      observer.disconnect()
      el.removeEventListener("scroll", snapshot)
    }
  }, [scrollRef, pinnedRef])
}
