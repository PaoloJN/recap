import type { LayoutDecision } from "./panel-layout"

export const LAYOUT_STYLE_ID = "recap-layout-style"

/**
 * YouTube sizes the watch page from custom properties on `ytd-watch-flexy`:
 * `--ytd-watch-flexy-sidebar-width` / `--ytd-watch-flexy-sidebar-min-width` for `#secondary`,
 * and the player width variables for `#primary`. The in-column player keeps its own
 * padding-top aspect ratio. Overriding `#columns`, `#primary`, or `#player` / `video`
 * — including `position: sticky` on `#player` — collapses that box (the video's
 * percentage height resolves to 0) and leaves a small video in a tall dark column.
 * Focus mode only changes the width variables, and leaves a gutter so
 * `max-player + sidebar + YouTube's column margins` stays inside the viewport.
 * Theater and fullscreen keep YouTube's player size. The panel host is stretched
 * to the sidebar and clipped, so a wide diagram cannot shift the card or paint
 * timestamp rows onto the page.
 */
export const LAYOUT_CSS = `
/* :host { all: initial } leaves the custom element inline, and the line box clips the card under the masthead. */
recap-panel.recap-host {
  display: block !important;
}
html.recap-sized ytd-watch-flexy:not([fullscreen]):not([theater]) #secondary,
html.recap-focus ytd-watch-flexy:not([fullscreen]):not([theater]) #secondary {
  transition: width 150ms ease, min-width 150ms ease, max-width 150ms ease;
}
html.recap-dragging, html.recap-dragging * {
  cursor: col-resize !important;
  user-select: none !important;
}
html.recap-dragging ytd-watch-flexy #secondary {
  transition: none !important;
}
html.recap-sized ytd-watch-flexy:not([fullscreen]):not([theater]) {
  --ytd-watch-flexy-sidebar-width: var(--recap-panel-width) !important;
  --ytd-watch-flexy-sidebar-min-width: var(--recap-panel-width) !important;
}
html.recap-focus ytd-watch-flexy:not([fullscreen]):not([theater]) {
  --ytd-watch-flexy-max-player-width: calc(40vw - 24px) !important;
  --ytd-watch-flexy-min-player-width: 320px !important;
  --ytd-watch-flexy-sidebar-width: calc(60vw - 120px) !important;
  --ytd-watch-flexy-sidebar-min-width: 360px !important;
}
html.recap-focus ytd-watch-flexy:not([fullscreen]) #secondary-inner > :not(recap-panel) {
  display: none !important;
}
html.recap-focus .recap-host {
  align-self: stretch !important;
  width: 100% !important;
  max-width: 100% !important;
  min-width: 0 !important;
  box-sizing: border-box !important;
  overflow: hidden !important;
  display: flex !important;
  flex-direction: column !important;
  z-index: 2;
}
html.recap-focus ytd-watch-flexy:not([fullscreen]):not([theater]) .recap-host {
  position: sticky !important;
  top: calc(var(--ytd-watch-flexy-masthead-height, 56px) + 12px);
  height: calc(100vh - var(--ytd-watch-flexy-masthead-height, 56px) - 24px) !important;
  max-height: calc(100vh - var(--ytd-watch-flexy-masthead-height, 56px) - 24px) !important;
}
html.recap-focus ytd-watch-flexy[theater]:not([fullscreen]) .recap-host {
  position: relative !important;
  height: min(720px, calc(100vh - 96px)) !important;
  max-height: min(720px, calc(100vh - 96px)) !important;
}
/* Above the masthead. The host is a stacking context, so the overlay cannot cover it otherwise. */
html.recap-diagram-open .recap-host {
  z-index: 2147483646 !important;
  overflow: visible !important;
}
@media (prefers-reduced-motion: reduce) {
  html.recap-sized ytd-watch-flexy #secondary,
  html.recap-focus ytd-watch-flexy #secondary {
    transition: none !important;
  }
}
`

export function ensureLayoutStyle(doc: Document): void {
  if (doc.getElementById(LAYOUT_STYLE_ID)) return
  const style = doc.createElement("style")
  style.id = LAYOUT_STYLE_ID
  style.textContent = LAYOUT_CSS
  doc.head.append(style)
}

export function applyPageLayout(doc: Document, decision: LayoutDecision, dragging = false): void {
  const root = doc.documentElement
  root.classList.toggle("recap-sized", decision.sized)
  root.classList.toggle("recap-focus", decision.focus)
  root.classList.toggle("recap-dragging", dragging)
  if (decision.cssWidth) root.style.setProperty("--recap-panel-width", decision.cssWidth)
  else root.style.removeProperty("--recap-panel-width")
}

/** Right-hand overlay. Closed, the host shrinks to the chip so it does not cover the page. */
export function applyDrawerLayout(
  host: HTMLElement,
  doc: Document,
  decision: LayoutDecision,
  open: boolean,
  dragging = false,
): void {
  doc.documentElement.classList.toggle("recap-dragging", dragging)
  host.style.position = "fixed"
  host.style.top = "0"
  host.style.right = "0"
  host.style.zIndex = "2147483646"
  host.style.boxSizing = "border-box"
  if (!open || decision.cssWidth === null) {
    host.style.height = "auto"
    host.style.width = "auto"
    host.style.maxHeight = ""
    return
  }
  host.style.height = "100vh"
  host.style.width = decision.cssWidth
  host.style.maxHeight = "100vh"
}

const FOCUS_HOST_PROPS = [
  "align-self",
  "width",
  "max-width",
  "min-width",
  "box-sizing",
  "overflow",
  "z-index",
  "position",
  "top",
  "height",
  "max-height",
] as const

const FOCUS_HOST_HEIGHT = "calc(100vh - var(--ytd-watch-flexy-masthead-height, 56px) - 24px)"
const THEATER_HOST_HEIGHT = "min(720px, calc(100vh - 96px))"

/**
 * Inline important, so it beats the shadow reset `:host { all: initial !important }`.
 * A stylesheet rule on `.recap-host` loses that fight, and the card then grows with the
 * diagram instead of scrolling inside the viewport.
 */
export function applyFocusHost(host: HTMLElement, focus: boolean, theater: boolean): void {
  if (!focus) {
    for (const prop of FOCUS_HOST_PROPS) host.style.removeProperty(prop)
    return
  }
  const overlay = host.shadowRoot?.querySelector("[data-testid='diagram-fullscreen']")
  host.style.setProperty("align-self", "stretch", "important")
  host.style.setProperty("width", "100%", "important")
  host.style.setProperty("max-width", "100%", "important")
  host.style.setProperty("min-width", "0", "important")
  host.style.setProperty("box-sizing", "border-box", "important")
  host.style.setProperty("z-index", "2", "important")
  host.style.setProperty("overflow", overlay ? "visible" : "hidden", "important")
  if (theater) {
    host.style.setProperty("position", "relative", "important")
    host.style.setProperty("top", "0", "important")
    host.style.setProperty("height", THEATER_HOST_HEIGHT, "important")
    host.style.setProperty("max-height", THEATER_HOST_HEIGHT, "important")
    return
  }
  host.style.setProperty("position", "sticky", "important")
  host.style.setProperty(
    "top",
    "calc(var(--ytd-watch-flexy-masthead-height, 56px) + 12px)",
    "important",
  )
  host.style.setProperty("height", FOCUS_HOST_HEIGHT, "important")
  host.style.setProperty("max-height", FOCUS_HOST_HEIGHT, "important")
}

export function clearDrawerLayout(host: HTMLElement, doc: Document): void {
  doc.documentElement.classList.remove("recap-dragging")
  host.style.position = ""
  host.style.top = ""
  host.style.right = ""
  host.style.zIndex = ""
  host.style.boxSizing = ""
  host.style.height = ""
  host.style.width = ""
  host.style.maxHeight = ""
}

export function clearPageLayout(doc: Document): void {
  const root = doc.documentElement
  root.classList.remove("recap-sized", "recap-focus", "recap-dragging")
  root.style.removeProperty("--recap-panel-width")
  doc.getElementById(LAYOUT_STYLE_ID)?.remove()
}
