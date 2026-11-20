import type { LayoutDecision } from "./panel-layout"

export const LAYOUT_STYLE_ID = "recap-layout-style"

/**
 * YouTube's watch page: `ytd-watch-flexy` > `#columns` > `#primary` (player + comments) and
 * `#secondary` (this panel). Theater moves the player into the full-bleed slot, so player
 * sizing is limited to the in-column player. Fullscreen is excluded; the host drops the
 * classes as well.
 */
export const LAYOUT_CSS = `
html.recap-sized ytd-watch-flexy:not([fullscreen]) #secondary,
html.recap-focus ytd-watch-flexy:not([fullscreen]) #primary,
html.recap-focus ytd-watch-flexy:not([fullscreen]) #secondary {
  transition: width 150ms ease, max-width 150ms ease, flex-basis 150ms ease;
}
html.recap-dragging, html.recap-dragging * {
  cursor: col-resize !important;
  user-select: none !important;
}
html.recap-dragging ytd-watch-flexy #primary,
html.recap-dragging ytd-watch-flexy #secondary {
  transition: none !important;
}
html.recap-sized ytd-watch-flexy:not([fullscreen]) #columns {
  display: flex !important;
  flex-direction: row !important;
  align-items: flex-start !important;
}
html.recap-sized ytd-watch-flexy:not([fullscreen]) #primary {
  flex: 1 1 auto !important;
  width: auto !important;
  min-width: 0 !important;
  max-width: none !important;
}
html.recap-sized ytd-watch-flexy:not([fullscreen]) #secondary {
  width: var(--recap-panel-width) !important;
  min-width: var(--recap-panel-width) !important;
  max-width: var(--recap-panel-width) !important;
  flex: 0 0 var(--recap-panel-width) !important;
}
html.recap-sized ytd-watch-flexy:not([fullscreen]):not([theater]) #player,
html.recap-focus ytd-watch-flexy:not([fullscreen]):not([theater]) #player {
  width: 100% !important;
  max-width: 100% !important;
  height: auto !important;
  aspect-ratio: 16 / 9;
}
html.recap-sized ytd-watch-flexy:not([fullscreen]):not([theater]) #player #movie_player,
html.recap-sized ytd-watch-flexy:not([fullscreen]):not([theater]) #player .html5-video-player,
html.recap-focus ytd-watch-flexy:not([fullscreen]):not([theater]) #player #movie_player,
html.recap-focus ytd-watch-flexy:not([fullscreen]):not([theater]) #player .html5-video-player,
html.recap-sized ytd-watch-flexy:not([fullscreen]):not([theater]) video.html5-main-video,
html.recap-focus ytd-watch-flexy:not([fullscreen]):not([theater]) video.html5-main-video {
  width: 100% !important;
  height: 100% !important;
  object-fit: contain !important;
}
html.recap-focus ytd-watch-flexy:not([fullscreen]) #columns {
  display: flex !important;
  flex-direction: row !important;
  align-items: stretch !important;
  width: 100% !important;
  max-width: none !important;
}
html.recap-focus ytd-watch-flexy:not([fullscreen]) #primary {
  flex: 0 0 40% !important;
  width: 40% !important;
  max-width: 40% !important;
  min-width: 0 !important;
}
html.recap-focus ytd-watch-flexy:not([fullscreen]):not([theater]) #player {
  position: sticky !important;
  top: 56px !important;
  z-index: 3;
}
html.recap-focus ytd-watch-flexy:not([fullscreen]) #secondary {
  flex: 1 1 auto !important;
  width: auto !important;
  min-width: 0 !important;
  max-width: none !important;
  min-height: calc(100vh - 72px) !important;
}
html.recap-focus ytd-watch-flexy:not([fullscreen]) #secondary-inner > :not(recap-panel) {
  display: none !important;
}
html.recap-focus .recap-host {
  position: sticky;
  top: 56px;
  align-self: flex-start;
  height: calc(100vh - 72px);
  display: flex;
  flex-direction: column;
  z-index: 2;
}
@media (prefers-reduced-motion: reduce) {
  html.recap-sized ytd-watch-flexy #secondary,
  html.recap-focus ytd-watch-flexy #primary,
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
