import { describe, expect, it } from "vitest"
import {
  clampScale,
  type DiagramView,
  DRAG_THRESHOLD_PX,
  fitWidth,
  isZoomWheel,
  movedPastThreshold,
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

  it("zooms only for ctrl, cmd, or pinch wheels", () => {
    expect(isZoomWheel({ ctrlKey: false, metaKey: false })).toBe(false)
    expect(isZoomWheel({ ctrlKey: true, metaKey: false })).toBe(true)
    expect(isZoomWheel({ ctrlKey: false, metaKey: true })).toBe(true)
  })
})
