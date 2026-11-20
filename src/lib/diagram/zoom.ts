/** Inclusive bounds for the diagram scale. */
export const ZOOM_MIN = 0.25
export const ZOOM_MAX = 4

/** A pointer move farther than this is a pan, not a click. */
export const DRAG_THRESHOLD_PX = 4

export interface DiagramView {
  scale: number
  x: number
  y: number
}

export function clampScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, scale))
}

/**
 * Zoom so the content point under (cursorX, cursorY) stays put.
 * Cursor coordinates are relative to the untransformed viewport.
 */
export function zoomAt(
  view: DiagramView,
  cursorX: number,
  cursorY: number,
  nextScale: number,
): DiagramView {
  const scale = clampScale(nextScale)
  if (!(view.scale > 0)) return { scale, x: view.x, y: view.y }
  const contentX = (cursorX - view.x) / view.scale
  const contentY = (cursorY - view.y) / view.scale
  return {
    scale,
    x: cursorX - contentX * scale,
    y: cursorY - contentY * scale,
  }
}

export function panBy(view: DiagramView, dx: number, dy: number): DiagramView {
  return { scale: view.scale, x: view.x + dx, y: view.y + dy }
}

/** Fit the content's width into the viewport. Height is left to pan. */
export function fitWidth(viewWidth: number, contentWidth: number): DiagramView {
  if (!(viewWidth > 0) || !(contentWidth > 0)) return { scale: 1, x: 0, y: 0 }
  return { scale: clampScale(viewWidth / contentWidth), x: 0, y: 0 }
}

/** True when the pointer traveled far enough that the gesture is a pan. */
export function movedPastThreshold(dx: number, dy: number, threshold = DRAG_THRESHOLD_PX): boolean {
  return dx * dx + dy * dy > threshold * threshold
}

/** Firefox reports wheel distance in lines; Chrome and trackpads report pixels. */
const WHEEL_LINE_PX = 16
const WHEEL_PAGE_PX = 800
/** Exponential zoom per pixel. A mouse notch (~100px) is a clear step; a trackpad's few pixels is a small one. */
const WHEEL_ZOOM_PER_PX = 0.002

export function wheelDeltaPixels(delta: number, deltaMode: number): number {
  if (!Number.isFinite(delta)) return 0
  if (deltaMode === 1) return delta * WHEEL_LINE_PX
  if (deltaMode === 2) return delta * WHEEL_PAGE_PX
  return delta
}

/** Wheel up (negative deltaY) zooms in. Line mode and pixel mode of the same distance match. */
export function wheelZoomFactor(deltaY: number, deltaMode = 0): number {
  return Math.exp(-wheelDeltaPixels(deltaY, deltaMode) * WHEEL_ZOOM_PER_PX)
}

export interface WheelInput {
  deltaX: number
  deltaY: number
  deltaMode: number
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
}

export type WheelAction = { kind: "zoom"; factor: number } | { kind: "pan"; dx: number; dy: number }

/** Plain wheel and pinch zoom. Shift+wheel pans sideways; pinch stays a zoom. */
export function wheelAction(event: WheelInput): WheelAction {
  const pinch = event.ctrlKey || event.metaKey
  if (event.shiftKey && !pinch) {
    const dx = wheelDeltaPixels(event.deltaX, event.deltaMode)
    const dy = wheelDeltaPixels(event.deltaY, event.deltaMode)
    if (dx === 0) return { kind: "pan", dx: -dy, dy: 0 }
    return { kind: "pan", dx: -dx, dy: -dy }
  }
  return { kind: "zoom", factor: wheelZoomFactor(event.deltaY, event.deltaMode) }
}

/** Apply one wheel event. A zoom keeps the content point under the cursor. */
export function applyWheel(
  view: DiagramView,
  cursorX: number,
  cursorY: number,
  event: WheelInput,
): DiagramView {
  const action = wheelAction(event)
  if (action.kind === "pan") return panBy(view, action.dx, action.dy)
  return zoomAt(view, cursorX, cursorY, view.scale * action.factor)
}
