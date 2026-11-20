export const DIAGRAM_SOURCE = "recap-diagram"
export const DIAGRAM_PAGE = "diagram-renderer.html"

export interface DiagramResultMessage {
  source: typeof DIAGRAM_SOURCE
  type: "result"
  id: string
  ok: boolean
  svg?: string
  error?: string
  /** Pixel height of an interactive render, so the panel can size the iframe. */
  height?: number
}

export interface DiagramNodeClickMessage {
  source: typeof DIAGRAM_SOURCE
  type: "node-click"
  nodeId: string
  x: number
  y: number
}

export function isDiagramResult(data: unknown): data is DiagramResultMessage {
  if (typeof data !== "object" || data === null) return false
  const msg = data as Record<string, unknown>
  return (
    msg.source === DIAGRAM_SOURCE &&
    msg.type === "result" &&
    typeof msg.id === "string" &&
    typeof msg.ok === "boolean"
  )
}

export function isDiagramNodeClick(data: unknown): data is DiagramNodeClickMessage {
  if (typeof data !== "object" || data === null) return false
  const msg = data as Record<string, unknown>
  return (
    msg.source === DIAGRAM_SOURCE &&
    msg.type === "node-click" &&
    typeof msg.nodeId === "string" &&
    msg.nodeId.length > 0 &&
    msg.nodeId.length <= 200 &&
    typeof msg.x === "number" &&
    Number.isFinite(msg.x) &&
    typeof msg.y === "number" &&
    Number.isFinite(msg.y)
  )
}

/** A diagram message is trusted only when both the extension origin and the iframe window match. */
export function isTrustedDiagramEvent(
  event: { origin: string; source: unknown },
  iframeWindow: unknown,
  extensionOrigin: string,
): boolean {
  return iframeWindow != null && event.origin === extensionOrigin && event.source === iframeWindow
}

export function isDiagramReady(data: unknown): boolean {
  if (typeof data !== "object" || data === null) return false
  const msg = data as Record<string, unknown>
  return msg.source === DIAGRAM_SOURCE && msg.type === "ready"
}

/** Parent tells a freshly loaded renderer which page framed it. */
export function isDiagramPing(data: unknown): boolean {
  if (typeof data !== "object" || data === null) return false
  const msg = data as Record<string, unknown>
  return msg.source === DIAGRAM_SOURCE && msg.type === "ping"
}

/** Origin of an http(s) page. Extension URLs and empty referrers are not parents. */
export function webPageOrigin(value: string): string | null {
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" && url.protocol !== "http:") return null
    return url.origin
  } catch {
    return null
  }
}
