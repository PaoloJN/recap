import { afterEach, describe, expect, it } from "vitest"
import { applyPageLayout, clearPageLayout, ensureLayoutStyle, LAYOUT_STYLE_ID } from "./page-style"
import { decideLayout } from "./panel-layout"

afterEach(() => {
  clearPageLayout(document)
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
