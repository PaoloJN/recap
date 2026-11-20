export const DIAGRAM_SOURCE = "recap-diagram"
export const DIAGRAM_PAGE = "diagram-renderer.html"

export interface DiagramResultMessage {
  source: typeof DIAGRAM_SOURCE
  type: "result"
  id: string
  ok: boolean
  svg?: string
  error?: string
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

export function isDiagramReady(data: unknown): boolean {
  if (typeof data !== "object" || data === null) return false
  const msg = data as Record<string, unknown>
  return msg.source === DIAGRAM_SOURCE && msg.type === "ready"
}
