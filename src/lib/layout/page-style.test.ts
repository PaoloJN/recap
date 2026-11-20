import { afterEach, describe, expect, it } from "vitest"
import {
  applyFocusHost,
  applyPageLayout,
  clearPageLayout,
  ensureLayoutStyle,
  LAYOUT_CSS,
  LAYOUT_STYLE_ID,
} from "./page-style"
import { decideLayout } from "./panel-layout"

afterEach(() => {
  clearPageLayout(document)
})

describe("watch page layout css", () => {
  it("sizes the sidebar through YouTube's variables and does not restyle the player", () => {
    expect(LAYOUT_CSS).toContain("--ytd-watch-flexy-sidebar-width: var(--recap-panel-width)")
    expect(LAYOUT_CSS).toContain("--ytd-watch-flexy-sidebar-min-width: var(--recap-panel-width)")
    expect(LAYOUT_CSS).toContain("recap-panel.recap-host")
    expect(LAYOUT_CSS).toContain("display: block !important")
    expect(LAYOUT_CSS).not.toContain("#columns")
    expect(LAYOUT_CSS).not.toContain("#primary")
    expect(LAYOUT_CSS).not.toContain("#player")
    expect(LAYOUT_CSS).not.toContain("html5-main-video")
    expect(LAYOUT_CSS).not.toContain("aspect-ratio")
    expect(LAYOUT_CSS).toContain(".recap-host")
    expect(LAYOUT_CSS).toContain("min-width: 0")
    expect(LAYOUT_CSS).toContain("overflow: hidden")
    expect(LAYOUT_CSS).toContain("calc(60vw - 120px)")
    expect(LAYOUT_CSS).toContain("width: 100%")
  })
})

describe("applyFocusHost", () => {
  it("pins the host height inline so the shadow reset cannot grow the card", () => {
    const host = document.createElement("div")
    applyFocusHost(host, true, false)
    expect(host.style.getPropertyPriority("height")).toBe("important")
    expect(host.style.height).toContain("100vh")
    expect(host.style.overflow).toBe("hidden")
    expect(host.style.position).toBe("sticky")

    const root = host.attachShadow({ mode: "open" })
    const overlay = document.createElement("div")
    overlay.dataset.testid = "diagram-fullscreen"
    root.append(overlay)
    applyFocusHost(host, true, false)
    expect(host.style.overflow).toBe("visible")

    applyFocusHost(host, true, true)
    expect(host.style.position).toBe("relative")
    expect(host.style.height).toContain("720px")

    applyFocusHost(host, false, false)
    expect(host.style.height).toBe("")
    expect(host.style.position).toBe("")
  })
})

describe("applyPageLayout", () => {
  it("sets the width variable only while the column should resize", () => {
    ensureLayoutStyle(document)
    applyPageLayout(
      document,
      decideLayout({
        open: true,
        fullscreen: false,
        viewportWidth: 1440,
        preferredWidth: 520,
        focus: false,
      }),
    )
    expect(document.documentElement.classList.contains("recap-sized")).toBe(true)
    expect(document.documentElement.style.getPropertyValue("--recap-panel-width")).toBe("520px")
    expect(document.getElementById(LAYOUT_STYLE_ID)?.textContent).toContain("--recap-panel-width")

    applyPageLayout(
      document,
      decideLayout({
        open: false,
        fullscreen: false,
        viewportWidth: 1440,
        preferredWidth: 520,
        focus: false,
      }),
    )
    expect(document.documentElement.classList.contains("recap-sized")).toBe(false)
    expect(document.documentElement.style.getPropertyValue("--recap-panel-width")).toBe("")
  })

  it("does not focus in fullscreen and marks an in-progress drag", () => {
    applyPageLayout(
      document,
      decideLayout({
        open: true,
        fullscreen: true,
        viewportWidth: 1440,
        preferredWidth: null,
        focus: true,
      }),
      true,
    )
    expect(document.documentElement.classList.contains("recap-focus")).toBe(false)
    expect(document.documentElement.classList.contains("recap-dragging")).toBe(true)
  })

  it("injects the stylesheet once and removes it on clear", () => {
    ensureLayoutStyle(document)
    ensureLayoutStyle(document)
    expect(document.querySelectorAll(`#${LAYOUT_STYLE_ID}`)).toHaveLength(1)
    clearPageLayout(document)
    expect(document.getElementById(LAYOUT_STYLE_ID)).toBeNull()
    expect(document.documentElement.className).toBe("")
  })
})
