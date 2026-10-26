import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react"
import { useStorageItem } from "@/hooks/useStorageItem"
import { panelStateItem } from "@/lib/storage"
import type { PanelTab, PanelView } from "@/lib/types"

export interface PanelNav {
  open: boolean
  setOpen(v: boolean): void
  tab: PanelTab
  selectTab(tab: PanelTab): void
  view: PanelView
  setView(view: PanelView): void
  /** Sub-header back: the connect view opened from Settings returns there, else to main. */
  goBack(): void
  optionsOpen: boolean
  setOptionsOpen(v: boolean): void
  /** Bumped by `requestSearchFocus`; the transcript search input focuses when it changes. */
  searchFocusToken: number
  requestSearchFocus(): void
}

const NavigationContext = createContext<PanelNav | null>(null)

/** `open`/`tab` persist in `local:panel`; children render once that has loaded. */
export function NavigationProvider({ children }: { children: ReactNode }) {
  const [panelState, setPanelState] = useStorageItem(panelStateItem)
  const [nav, setNav] = useState<{ view: PanelView; back: PanelView }>({
    view: "main",
    back: "main",
  })
  const view = nav.view
  const setView = useCallback(
    (next: PanelView) =>
      setNav((cur) => ({
        view: next,
        back: next === "onboarding" && cur.view === "settings" ? "settings" : "main",
      })),
    [],
  )
  const goBack = useCallback(() => setNav((cur) => ({ view: cur.back, back: "main" })), [])
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [searchFocusToken, setSearchFocusToken] = useState(0)

  const open = panelState?.open ?? false
  const tab = panelState?.tab ?? "summary"

  const setOpen = useCallback(
    (v: boolean) => void setPanelState({ tab, open: v }),
    [setPanelState, tab],
  )
  const selectTab = useCallback(
    (next: PanelTab) => {
      setView("main")
      void setPanelState({ tab: next, open: true })
    },
    [setPanelState, setView],
  )
  const requestSearchFocus = useCallback(() => setSearchFocusToken((t) => t + 1), [])

  const value = useMemo<PanelNav>(
    () => ({
      open,
      setOpen,
      tab,
      selectTab,
      view,
      setView,
      goBack,
      optionsOpen,
      setOptionsOpen,
      searchFocusToken,
      requestSearchFocus,
    }),
    [
      open,
      setOpen,
      tab,
      selectTab,
      view,
      setView,
      goBack,
      optionsOpen,
      searchFocusToken,
      requestSearchFocus,
    ],
  )

  if (!panelState) return null
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>
}

export function usePanelNav(): PanelNav {
  const value = useContext(NavigationContext)
  if (!value) throw new Error("usePanelNav must be used inside a NavigationProvider")
  return value
}
