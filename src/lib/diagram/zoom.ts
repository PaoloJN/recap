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

/** Ctrl/Cmd+wheel and trackpad pinch (browsers set ctrlKey). Plain wheel does not zoom. */
export function isZoomWheel(event: { ctrlKey: boolean; metaKey: boolean }): boolean {
  return event.ctrlKey || event.metaKey
}
