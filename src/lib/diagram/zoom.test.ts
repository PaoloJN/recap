import { describe, expect, it } from "vitest"
import {
  applyWheel,
  clampScale,
  type DiagramView,
  DRAG_THRESHOLD_PX,
  fitWidth,
  movedPastThreshold,
  type WheelInput,
  wheelAction,
  wheelZoomFactor,
  ZOOM_MAX,
  ZOOM_MIN,
  zoomAt,
} from "./zoom"

function pointUnder(view: DiagramView, cursorX: number, cursorY: number) {
  return {
    x: (cursorX - view.x) / view.scale,
    y: (cursorY - view.y) / view.scale,
  }
}

describe("diagram zoom", () => {
  it("clamps the scale to 0.25–4", () => {
    expect(clampScale(0.1)).toBe(ZOOM_MIN)
    expect(clampScale(0.25)).toBe(0.25)
    expect(clampScale(1)).toBe(1)
    expect(clampScale(4)).toBe(4)
    expect(clampScale(9)).toBe(ZOOM_MAX)
    expect(clampScale(Number.NaN)).toBe(1)
    expect(zoomAt({ scale: 1, x: 0, y: 0 }, 0, 0, 10).scale).toBe(4)
    expect(zoomAt({ scale: 1, x: 0, y: 0 }, 0, 0, 0.01).scale).toBe(0.25)
  })

  it("zooms around the cursor so the content point stays fixed", () => {
    const view: DiagramView = { scale: 1, x: 0, y: 0 }
    const next = zoomAt(view, 100, 50, 2)
    expect(next).toEqual({ scale: 2, x: -100, y: -50 })
    expect(pointUnder(next, 100, 50)).toEqual(pointUnder(view, 100, 50))

    const panned: DiagramView = { scale: 2, x: -40, y: 10 }
    const again = zoomAt(panned, 80, 30, 3)
    expect(again.scale).toBe(3)
    expect(pointUnder(again, 80, 30).x).toBeCloseTo(pointUnder(panned, 80, 30).x)
    expect(pointUnder(again, 80, 30).y).toBeCloseTo(pointUnder(panned, 80, 30).y)
  })

  it("does not move the diagram when the scale is already at the limit", () => {
    const view: DiagramView = { scale: 4, x: -20, y: 8 }
    expect(zoomAt(view, 40, 40, 8)).toEqual(view)
  })

  it("fits the content width and still clamps", () => {
    expect(fitWidth(400, 800)).toEqual({ scale: 0.5, x: 0, y: 0 })
    expect(fitWidth(100, 10_000).scale).toBe(ZOOM_MIN)
    expect(fitWidth(10_000, 100).scale).toBe(ZOOM_MAX)
    expect(fitWidth(0, 100)).toEqual({ scale: 1, x: 0, y: 0 })
  })

  it("treats a move of more than 4px as a pan", () => {
    expect(DRAG_THRESHOLD_PX).toBe(4)
    expect(movedPastThreshold(4, 0)).toBe(false)
    expect(movedPastThreshold(0, 4)).toBe(false)
    expect(movedPastThreshold(2.8, 2.8)).toBe(false)
    expect(movedPastThreshold(4.1, 0)).toBe(true)
    expect(movedPastThreshold(3, 3)).toBe(true)
    expect(movedPastThreshold(-5, 0)).toBe(true)
  })

  it("keeps the point under the cursor for a plain wheel and a pinch", () => {
    const view: DiagramView = { scale: 1.4, x: 20, y: -10 }
    const cursorX = 120
    const cursorY = 80
    const before = pointUnder(view, cursorX, cursorY)
    const base: WheelInput = {
      deltaX: 0,
      deltaY: -48,
      deltaMode: 0,
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
    }
    for (const event of [base, { ...base, ctrlKey: true }, { ...base, deltaMode: 1, deltaY: -3 }]) {
      const next = applyWheel(view, cursorX, cursorY, event)
      expect(next.scale).toBeGreaterThan(view.scale)
      expect(next.scale).toBeLessThanOrEqual(ZOOM_MAX)
      const after = pointUnder(next, cursorX, cursorY)
      expect(after.x).toBeCloseTo(before.x)
      expect(after.y).toBeCloseTo(before.y)
    }
  })

  it("zooms in on wheel up, out on wheel down, and matches a line to its pixels", () => {
    expect(wheelZoomFactor(-100, 0)).toBeGreaterThan(1)
    expect(wheelZoomFactor(100, 0)).toBeLessThan(1)
    expect(wheelZoomFactor(-3, 1)).toBeCloseTo(wheelZoomFactor(-48, 0))
    const trackpad = wheelZoomFactor(-4, 0)
    expect(trackpad).toBeGreaterThan(1)
    expect(trackpad).toBeLessThan(1.02)
    const zoomed = applyWheel({ scale: 4, x: -20, y: 8 }, 40, 40, {
      deltaX: 0,
      deltaY: -400,
      deltaMode: 0,
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
    })
    expect(zoomed).toEqual({ scale: 4, x: -20, y: 8 })
  })

  it("pans sideways on shift+wheel and still zooms a pinch", () => {
    const view: DiagramView = { scale: 1, x: 0, y: 0 }
    const panned = applyWheel(view, 10, 10, {
      deltaX: 0,
      deltaY: 32,
      deltaMode: 0,
      shiftKey: true,
      ctrlKey: false,
      metaKey: false,
    })
    expect(panned).toEqual({ scale: 1, x: -32, y: 0 })
    const pinch = wheelAction({
      deltaX: 0,
      deltaY: -20,
      deltaMode: 0,
      shiftKey: true,
      ctrlKey: true,
      metaKey: false,
    })
    expect(pinch.kind).toBe("zoom")
  })
})
