import { describe, expect, it } from "vitest"
import {
  clampPanelWidth,
  composerMaxPx,
  decideLayout,
  FOCUS_MIN_PX,
  isPageFullscreen,
  nextFocus,
  PANEL_DEFAULT_PX,
  PANEL_MIN_PX,
  readLayout,
  SIDE_BY_SIDE_MIN_PX,
  widthFromDrag,
  widthFromKey,
} from "./panel-layout"

describe("clampPanelWidth", () => {
  it("falls back to the default for a non-finite request", () => {
    expect(clampPanelWidth(Number.NaN, 1440)).toBe(PANEL_DEFAULT_PX)
    expect(clampPanelWidth(Number.POSITIVE_INFINITY, 1440)).toBe(PANEL_DEFAULT_PX)
  })

  it("clamps to 360 and 60% of the viewport", () => {
    expect(clampPanelWidth(200, 1440)).toBe(PANEL_MIN_PX)
    expect(clampPanelWidth(2000, 1440)).toBe(864)
    expect(clampPanelWidth(520.4, 1440)).toBe(520)
    expect(clampPanelWidth(1000, 1920)).toBe(1000)
    expect(clampPanelWidth(2000, 1920)).toBe(1152)
  })

  it("never reports a max below the minimum", () => {
    expect(clampPanelWidth(800, 400)).toBe(PANEL_MIN_PX)
  })
})

describe("decideLayout", () => {
  const open = {
    open: true,
    fullscreen: false,
    viewportWidth: 1440,
    preferredWidth: 520,
    focus: false,
  }

  it("sizes the sidebar only while the panel is open beside the player", () => {
    expect(decideLayout(open)).toMatchObject({ sized: true, focus: false, cssWidth: "520px" })
    expect(decideLayout({ ...open, open: false })).toMatchObject({
      sized: false,
      focus: false,
      cssWidth: null,
    })
    expect(decideLayout({ ...open, fullscreen: true })).toMatchObject({
      sized: false,
      focus: false,
      cssWidth: null,
    })
    expect(decideLayout({ ...open, viewportWidth: SIDE_BY_SIDE_MIN_PX - 1 })).toMatchObject({
      sized: false,
      cssWidth: null,
    })
  })

  it("clamps the painted width and leaves the stored preference alone", () => {
    const prefs = { width: 900, focus: false }
    const cramped = decideLayout({
      open: true,
      fullscreen: false,
      viewportWidth: 1200,
      preferredWidth: prefs.width,
      focus: prefs.focus,
    })
    expect(cramped.cssWidth).toBe("720px")
    expect(prefs).toEqual({ width: 900, focus: false })
    const grown = decideLayout({
      open: true,
      fullscreen: false,
      viewportWidth: 1920,
      preferredWidth: prefs.width,
      focus: false,
    })
    expect(grown.cssWidth).toBe("900px")
  })

  it("uses the default width when nothing is stored", () => {
    expect(decideLayout({ ...open, preferredWidth: null }).widthPx).toBe(PANEL_DEFAULT_PX)
  })

  it("gives focus mode the row and drops the fixed sidebar width", () => {
    expect(decideLayout({ ...open, focus: true })).toMatchObject({
      sized: false,
      focus: true,
      cssWidth: null,
    })
  })

  it("keeps focus off when the panel is closed, fullscreen, or the window is narrow", () => {
    expect(decideLayout({ ...open, focus: true, open: false }).focus).toBe(false)
    expect(decideLayout({ ...open, focus: true, fullscreen: true }).focus).toBe(false)
    expect(decideLayout({ ...open, focus: true, viewportWidth: FOCUS_MIN_PX - 1 }).focus).toBe(
      false,
    )
  })
})

describe("nextFocus", () => {
  it("toggles while there is room", () => {
    expect(nextFocus(false, false, 1440)).toBe(true)
    expect(nextFocus(true, false, 1440)).toBe(false)
  })

  it("does nothing in fullscreen", () => {
    expect(nextFocus(false, true, 1440)).toBeNull()
    expect(nextFocus(true, true, 1440)).toBeNull()
  })

  it("refuses to enter on a narrow window and still allows leaving", () => {
    expect(nextFocus(false, false, 800)).toBeNull()
    expect(nextFocus(true, false, 800)).toBe(false)
  })
})

describe("widthFromDrag", () => {
  it("widens as the pointer moves left and clamps", () => {
    expect(widthFromDrag(400, 1000, 800, 1440)).toBe(600)
    expect(widthFromDrag(400, 1000, 1200, 1440)).toBe(PANEL_MIN_PX)
    expect(widthFromDrag(800, 500, 0, 1440)).toBe(864)
  })
})

describe("widthFromKey", () => {
  it("steps, jumps, and ignores other keys", () => {
    expect(widthFromKey(400, "ArrowLeft", false, 1440)).toBe(416)
    expect(widthFromKey(400, "ArrowLeft", true, 1440)).toBe(448)
    expect(widthFromKey(400, "ArrowRight", false, 1440)).toBe(384)
    expect(widthFromKey(800, "Home", false, 1440)).toBe(PANEL_MIN_PX)
    expect(widthFromKey(400, "End", false, 1440)).toBe(864)
    expect(widthFromKey(400, "ArrowUp", false, 1440)).toBeNull()
  })
})

describe("readLayout", () => {
  it("accepts a stored preference and drops junk", () => {
    expect(readLayout({ width: 640, focus: true })).toEqual({ width: 640, focus: true })
    expect(readLayout({ width: "640", focus: 1 })).toEqual({ width: null, focus: false })
    expect(readLayout(null)).toEqual({ width: null, focus: false })
    expect(readLayout({ width: Number.NaN, focus: false })).toEqual({ width: null, focus: false })
  })
})

describe("composerMaxPx", () => {
  it("is 40% of the card with a floor", () => {
    expect(composerMaxPx(640)).toBe(256)
    expect(composerMaxPx(1000)).toBe(400)
    expect(composerMaxPx(0)).toBe(96)
  })
})

describe("isPageFullscreen", () => {
  it("reads the watch flexy fullscreen attribute", () => {
    document.body.innerHTML = "<ytd-watch-flexy></ytd-watch-flexy>"
    expect(isPageFullscreen(document)).toBe(false)
    document.querySelector("ytd-watch-flexy")?.setAttribute("fullscreen", "")
    expect(isPageFullscreen(document)).toBe(true)
    document.body.innerHTML = ""
  })
})
