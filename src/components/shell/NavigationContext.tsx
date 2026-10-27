import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react"
import { useStorageItem } from "@/hooks/useStorageItem"
import { panelStateItem } from "@/lib/storage"
import type { PanelTab, PanelView } from "@/lib/types"

/** The onboarding view's screen: the Recap Pro welcome, or the API key form. */
export type OnboardingScreen = "welcome" | "key"

export interface PanelNav {
  open: boolean
  setOpen(v: boolean): void
  tab: PanelTab
  selectTab(tab: PanelTab): void
  view: PanelView
  /** `screen` picks the onboarding screen (default: welcome; only used in builds with Recap Pro). */
  setView(view: PanelView, opts?: { screen?: OnboardingScreen }): void
  onboardingScreen: OnboardingScreen
  /**
   * Sub-header back: the key screen opened from the welcome screen returns there, the connect
   * view opened from Settings returns there, else to main.
   */
  goBack(): void
  optionsOpen: boolean
  setOptionsOpen(v: boolean): void
  /**
   * Set by `requestSearchFocus`; the transcript search input focuses and calls
   * `consumeSearchFocus` once it is mounted and visible (also called on video change).
   */
  searchFocusPending: boolean
  requestSearchFocus(): void
  consumeSearchFocus(): void
}

const NavigationContext = createContext<PanelNav | null>(null)

interface NavState {
  view: PanelView
  back: PanelView
  screen: OnboardingScreen
  /** The key screen was reached from the welcome screen, so back returns there. */
  keyFromWelcome: boolean
}

const INITIAL_NAV: NavState = {
  view: "main",
  back: "main",
  screen: "welcome",
  keyFromWelcome: false,
}

/** `open`/`tab` persist in `local:panel`; children render once that has loaded. */
export function NavigationProvider({ children }: { children: ReactNode }) {
  const [panelState, setPanelState] = useStorageItem(panelStateItem)
  const [nav, setNav] = useState<NavState>(INITIAL_NAV)
  const view = nav.view
  const onboardingScreen = nav.screen
  const setView = useCallback(
    (next: PanelView, opts?: { screen?: OnboardingScreen }) =>
      setNav((cur) => {
        const screen = opts?.screen ?? "welcome"
        // Welcome → key keeps welcome's own way back.
        if (next === "onboarding" && cur.view === "onboarding") {
          return {
            ...cur,
            screen,
            keyFromWelcome: screen === "key" && (cur.screen === "welcome" || cur.keyFromWelcome),
          }
        }
        return {
          view: next,
          back: next === "onboarding" && cur.view === "settings" ? "settings" : "main",
          screen,
          keyFromWelcome: false,
        }
      }),
    [],
  )
  const goBack = useCallback(
    () =>
      setNav((cur) =>
        cur.view === "onboarding" && cur.screen === "key" && cur.keyFromWelcome
          ? { ...cur, screen: "welcome", keyFromWelcome: false }
          : { ...INITIAL_NAV, view: cur.back },
      ),
    [],
  )
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [searchFocusPending, setSearchFocusPending] = useState(false)

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
  const requestSearchFocus = useCallback(() => setSearchFocusPending(true), [])
  const consumeSearchFocus = useCallback(() => setSearchFocusPending(false), [])

  const value = useMemo<PanelNav>(
    () => ({
      open,
      setOpen,
      tab,
      selectTab,
      view,
      setView,
      onboardingScreen,
      goBack,
      optionsOpen,
      setOptionsOpen,
      searchFocusPending,
      requestSearchFocus,
      consumeSearchFocus,
    }),
    [
      open,
      setOpen,
      tab,
      selectTab,
      view,
      setView,
      onboardingScreen,
      goBack,
      optionsOpen,
      searchFocusPending,
      requestSearchFocus,
      consumeSearchFocus,
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
