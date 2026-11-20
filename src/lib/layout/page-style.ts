import type { LayoutDecision } from "./panel-layout"

export const LAYOUT_STYLE_ID = "recap-layout-style"

/**
 * YouTube sizes the watch page from custom properties on `ytd-watch-flexy`:
 * `--ytd-watch-flexy-sidebar-width` / `--ytd-watch-flexy-sidebar-min-width` for `#secondary`,
 * and the player width variables for `#primary`. The in-column player keeps its own
 * padding-top aspect ratio. Overriding `#columns`, `#primary`, or `#player` / `video`
 * collapses that box (the video's percentage height resolves to 0) and can shrink the
 * whole left column to a blank strip. Theater and fullscreen keep YouTube's layout.
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
  --ytd-watch-flexy-max-player-width: 40vw !important;
  --ytd-watch-flexy-min-player-width: 40vw !important;
  --ytd-watch-flexy-sidebar-width: calc(100vw - 40vw - 48px) !important;
  --ytd-watch-flexy-sidebar-min-width: 360px !important;
}
html.recap-focus ytd-watch-flexy:not([fullscreen]):not([theater]) #player {
  position: sticky;
  top: calc(var(--ytd-watch-flexy-masthead-height, 56px) + var(--ytd-watch-flexy-top-padding, 12px));
  z-index: 3;
}
html.recap-focus ytd-watch-flexy:not([fullscreen]) #secondary-inner > :not(recap-panel) {
  display: none !important;
}
html.recap-focus .recap-host {
  position: sticky;
  top: calc(var(--ytd-watch-flexy-masthead-height, 56px) + var(--ytd-watch-flexy-top-padding, 12px));
  align-self: flex-start;
  max-height: calc(100vh - 72px);
  display: flex;
  flex-direction: column;
  z-index: 2;
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
