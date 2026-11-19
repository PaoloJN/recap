import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useStorageItem } from "@/hooks/useStorageItem"
import { applyPageLayout, clearPageLayout, ensureLayoutStyle } from "@/lib/layout/page-style"
import {
  decideLayout,
  isPageFullscreen,
  type LayoutPrefs,
  nextFocus,
  readLayout,
} from "@/lib/layout/panel-layout"
import { layoutItem } from "@/lib/storage"
import { cn } from "@/lib/utils"
import { usePanelNav } from "./NavigationContext"

export interface LayoutController {
  widthPx: number
  maxPx: number
  /** Focus layout is actually applied (off in fullscreen and on a narrow window). */
  focus: boolean
  /** Last choice in storage, including while fullscreen hides it. */
  storedFocus: boolean
  canResize: boolean
  /** False in fullscreen or when the window is too narrow to enter. */
  canFocus: boolean
  /** False when the button and shortcut should no-op (fullscreen, or too narrow to enter). */
  canToggle: boolean
  ready: boolean
  toggleFocus(): void
  previewWidth(width: number): void
  commitWidth(width: number): void
  resetWidth(): void
}

const LayoutContext = createContext<LayoutController | null>(null)

export function useLayout(): LayoutController {
  const value = useContext(LayoutContext)
  if (!value) throw new Error("useLayout outside LayoutProvider")
  return value
}

function hostOf(container: HTMLElement): HTMLElement {
  const root = container.getRootNode()
  return root instanceof ShadowRoot ? (root.host as HTMLElement) : container
}

export function LayoutProvider({
  container,
  children,
}: {
  container: HTMLElement
  children: ReactNode
}) {
  const { open, selectTab } = usePanelNav()
  const [stored, setStored] = useStorageItem(layoutItem)
  const ready = stored !== undefined
  const prefs: LayoutPrefs =
    stored === undefined ? { width: null, focus: false } : readLayout(stored)
  const prefsRef = useRef<LayoutPrefs>(prefs)
  useEffect(() => {
    if (stored !== undefined) prefsRef.current = readLayout(stored)
  }, [stored])
  const openRef = useRef(open)
  openRef.current = open

  const [viewport, setViewport] = useState(() => window.innerWidth)
  const [fullscreen, setFullscreen] = useState(() => isPageFullscreen(document))
  const fullscreenRef = useRef(fullscreen)
  fullscreenRef.current = fullscreen
  // undefined: follow storage. null: reset to the default. number: a drag that storage has not echoed yet.
  const [live, setLive] = useState<number | null | undefined>(undefined)
  const draggingRef = useRef(false)

  const write = useCallback(
    (next: LayoutPrefs) => {
      prefsRef.current = next
      void setStored(next)
    },
    [setStored],
  )

  const paint = useCallback((preferred: number | null, dragging: boolean) => {
    applyPageLayout(
      document,
      decideLayout({
        open: openRef.current,
        fullscreen: fullscreenRef.current,
        viewportWidth: window.innerWidth,
        preferredWidth: preferred,
        focus: prefsRef.current.focus,
      }),
      dragging,
    )
  }, [])

  useEffect(() => {
    if (live !== undefined && prefs.width === live) setLive(undefined)
  }, [live, prefs.width])

  useEffect(() => {
    const onResize = () => setViewport(window.innerWidth)
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  useEffect(() => {
    const sync = () => setFullscreen(isPageFullscreen(document))
    document.addEventListener("fullscreenchange", sync)
    const flexy = document.querySelector("ytd-watch-flexy")
    const observer = new MutationObserver(sync)
    if (flexy) observer.observe(flexy, { attributes: true, attributeFilter: ["fullscreen"] })
    return () => {
      document.removeEventListener("fullscreenchange", sync)
      observer.disconnect()
    }
  }, [])

  const preferredWidth = live === undefined ? prefs.width : live
  const decision = useMemo(
    () =>
      decideLayout({
        open,
        fullscreen,
        viewportWidth: viewport,
        preferredWidth,
        focus: prefs.focus,
      }),
    [open, fullscreen, viewport, preferredWidth, prefs.focus],
  )

  useEffect(() => {
    const host = hostOf(container)
    host.classList.add("recap-host")
    ensureLayoutStyle(document)
    return () => {
      host.classList.remove("recap-host")
      clearPageLayout(document)
      container.style.height = ""
      container.style.flex = ""
      container.style.minHeight = ""
      container.style.display = ""
      container.style.flexDirection = ""
    }
  }, [container])

  const applied = useRef<string | null>(null)
  useEffect(() => {
    if (!ready || draggingRef.current) return
    applyPageLayout(document, decision, false)
    container.style.height = decision.focus ? "100%" : ""
    container.style.flex = decision.focus ? "1 1 auto" : ""
    container.style.minHeight = decision.focus ? "0" : ""
    container.style.display = decision.focus ? "flex" : ""
    container.style.flexDirection = decision.focus ? "column" : ""
    const sig = `${decision.sized}:${decision.focus}:${decision.cssWidth}`
    if (applied.current === sig) return
    applied.current = sig
    const frame = requestAnimationFrame(() => window.dispatchEvent(new Event("resize")))
    return () => cancelAnimationFrame(frame)
  }, [ready, decision, container])

  const toggleFocus = useCallback(() => {
    if (!ready) return
    const next = nextFocus(prefsRef.current.focus, isPageFullscreen(document), window.innerWidth)
    if (next === null) return
    if (next) selectTab("chat")
    write({ width: prefsRef.current.width, focus: next })
  }, [ready, selectTab, write])

  useEffect(() => {
    const onCommand = () => toggleFocus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !decision.focus) return
      const root = container.getRootNode()
      if (root instanceof ShadowRoot && root.querySelector("[data-testid='diagram-node-menu']")) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      write({ width: prefsRef.current.width, focus: false })
    }
    document.addEventListener("recap-focus-mode", onCommand)
    document.addEventListener("keydown", onKey, true)
    return () => {
      document.removeEventListener("recap-focus-mode", onCommand)
      document.removeEventListener("keydown", onKey, true)
    }
  }, [toggleFocus, decision.focus, container, write])

  const previewWidth = useCallback(
    (width: number) => {
      draggingRef.current = true
      paint(width, true)
    },
    [paint],
  )

  const commitWidth = useCallback(
    (width: number) => {
      draggingRef.current = false
      setLive(width)
      write({ width, focus: prefsRef.current.focus })
      paint(width, false)
      window.dispatchEvent(new Event("resize"))
    },
    [paint, write],
  )

  const resetWidth = useCallback(() => {
    draggingRef.current = false
    setLive(null)
    write({ width: null, focus: prefsRef.current.focus })
    paint(null, false)
    window.dispatchEvent(new Event("resize"))
  }, [paint, write])

  const value = useMemo<LayoutController>(
    () => ({
      widthPx: decision.widthPx,
      maxPx: decision.maxPx,
      focus: decision.focus,
      storedFocus: prefs.focus,
      canResize: ready && decision.sized,
      canFocus: nextFocus(false, fullscreen, viewport) === true,
      canToggle: nextFocus(prefs.focus, fullscreen, viewport) !== null,
      ready,
      toggleFocus,
      previewWidth,
      commitWidth,
      resetWidth,
    }),
    [
      decision,
      prefs.focus,
      ready,
      fullscreen,
      viewport,
      toggleFocus,
      previewWidth,
      commitWidth,
      resetWidth,
    ],
  )

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>
}

export function LayoutFrame({ children }: { children: ReactNode }) {
  const { focus } = useLayout()
  return (
    <div
      className={cn(
        "relative font-sans text-foreground antialiased",
        focus ? "flex h-full min-h-0 flex-col" : "mb-[12px]",
      )}
    >
      {children}
    </div>
  )
}
