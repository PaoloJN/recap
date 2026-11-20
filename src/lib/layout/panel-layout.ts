/** Sidebar width and focus-mode decisions. Display width is clamped; the stored preference is not. */

export const PANEL_MIN_PX = 360
export const PANEL_DEFAULT_PX = 400
export const PANEL_MAX_RATIO = 0.6
export const FOCUS_PLAYER_RATIO = 0.4
/** Below this, YouTube stacks the columns, so a fixed sidebar width would crush the player. */
export const SIDE_BY_SIDE_MIN_PX = PANEL_MIN_PX + 640
/** 40% of the viewport still leaves a readable player. */
export const FOCUS_MIN_PX = 900
const KEY_STEP = 16
const KEY_STEP_LARGE = 48

export interface LayoutPrefs {
  /** User's chosen width, or null for the 400px default. Not clamped to the current window. */
  width: number | null
  focus: boolean
}

export interface LayoutInput {
  open: boolean
  fullscreen: boolean
  viewportWidth: number
  preferredWidth: number | null
  focus: boolean
}

export interface LayoutDecision {
  /** Fixed sidebar width. Off while closed, fullscreen, stacked, or in focus mode. */
  sized: boolean
  /** Video on the left, panel filling the rest. Off while closed, fullscreen, or too narrow. */
  focus: boolean
  cssWidth: string | null
  widthPx: number
  maxPx: number
}

export function panelMaxPx(viewportWidth: number): number {
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) return PANEL_MIN_PX
  return Math.max(PANEL_MIN_PX, Math.floor(viewportWidth * PANEL_MAX_RATIO))
}

export function clampPanelWidth(requested: number, viewportWidth: number): number {
  if (!Number.isFinite(requested)) return PANEL_DEFAULT_PX
  const max = panelMaxPx(viewportWidth)
  return Math.min(max, Math.max(PANEL_MIN_PX, Math.round(requested)))
}

export function sideBySideFits(viewportWidth: number): boolean {
  return viewportWidth >= SIDE_BY_SIDE_MIN_PX
}

export function focusFits(viewportWidth: number): boolean {
  return viewportWidth >= FOCUS_MIN_PX
}

/** What to paint. Does not rewrite the stored preference, so a wide width returns when the window grows. */
/** Floating drawer. Focus uses about 60% of the window. The stored width is left alone. */
export const DRAWER_FOCUS_RATIO = 0.6

export function decideDrawerLayout(input: LayoutInput): LayoutDecision {
  const maxPx = panelMaxPx(input.viewportWidth)
  const stored = clampPanelWidth(input.preferredWidth ?? PANEL_DEFAULT_PX, input.viewportWidth)
  const focusWidth = clampPanelWidth(
    Math.round(input.viewportWidth * DRAWER_FOCUS_RATIO),
    input.viewportWidth,
  )
  const focus = input.open && input.focus && !input.fullscreen && focusFits(input.viewportWidth)
  const sized = input.open && !input.fullscreen && !focus
  const widthPx = focus ? focusWidth : stored
  return {
    sized,
    focus,
    cssWidth: input.open && !input.fullscreen ? `${widthPx}px` : null,
    widthPx,
    maxPx,
  }
}

export function decideLayout(input: LayoutInput): LayoutDecision {
  const widthPx = clampPanelWidth(input.preferredWidth ?? PANEL_DEFAULT_PX, input.viewportWidth)
  const maxPx = panelMaxPx(input.viewportWidth)
  const room = input.open && !input.fullscreen && sideBySideFits(input.viewportWidth)
  const focus = input.open && input.focus && !input.fullscreen && focusFits(input.viewportWidth)
  const sized = room && !focus
  return {
    sized,
    focus,
    cssWidth: sized ? `${widthPx}px` : null,
    widthPx,
    maxPx,
  }
}

/**
 * Next stored focus flag. `null` means the control does nothing: fullscreen, or the window is
 * too narrow to enter focus. Leaving focus is still allowed on a narrow window.
 */
export function nextFocus(
  stored: boolean,
  fullscreen: boolean,
  viewportWidth: number,
): boolean | null {
  if (fullscreen) return null
  const next = !stored
  if (next && !focusFits(viewportWidth)) return null
  return next
}

/** Panel sits on the right, so moving the pointer left widens it. */
export function widthFromDrag(
  startWidth: number,
  startX: number,
  clientX: number,
  viewportWidth: number,
): number {
  return clampPanelWidth(startWidth + (startX - clientX), viewportWidth)
}

/** ArrowLeft widens. Shift uses a larger step. Home/End jump to the ends. */
export function widthFromKey(
  current: number,
  key: string,
  shift: boolean,
  viewportWidth: number,
): number | null {
  const step = shift ? KEY_STEP_LARGE : KEY_STEP
  switch (key) {
    case "ArrowLeft":
      return clampPanelWidth(current + step, viewportWidth)
    case "ArrowRight":
      return clampPanelWidth(current - step, viewportWidth)
    case "Home":
      return clampPanelWidth(PANEL_MIN_PX, viewportWidth)
    case "End":
      return clampPanelWidth(viewportWidth * PANEL_MAX_RATIO, viewportWidth)
    default:
      return null
  }
}

export function readLayout(stored: unknown): LayoutPrefs {
  if (typeof stored !== "object" || stored === null) return { width: null, focus: false }
  const raw = stored as Record<string, unknown>
  const width = typeof raw.width === "number" && Number.isFinite(raw.width) ? raw.width : null
  return { width, focus: raw.focus === true }
}

/** Composer cap: 40% of the card, with a floor so a short card still fits a couple of lines. */
export function composerMaxPx(panelHeight: number): number {
  if (!Number.isFinite(panelHeight) || panelHeight <= 0) return 96
  return Math.max(96, Math.round(panelHeight * 0.4))
}

export function isPageFullscreen(doc: Document): boolean {
  if (doc.fullscreenElement) return true
  return doc.querySelector("ytd-watch-flexy")?.hasAttribute("fullscreen") ?? false
}
