import { parseTimestamp } from "@/lib/timestamps"
import type { DiagramLink } from "@/lib/types"

const DIAGRAM_START =
  /^(?:flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|C4Context|C4Container|mindmap|timeline|journey|block-beta|architecture-beta)\b/

// Label, then an em dash, en dash, hyphen, or colon, then m:ss or h:mm:ss.
const LINK_LINE = /^[-*]\s+(.+?)\s+(?:—|–|-|:)\s+((?:\d{1,2}:)?\d{1,2}:\d{2})\s*$/

const FENCE = /```([^\n`]*)\n([\s\S]*?)```/g

function looksLikeMermaid(text: string): boolean {
  return DIAGRAM_START.test(text.trim())
}

function fenceBody(body: string | undefined): string {
  return (body ?? "").replace(/^mermaid\s*\n/i, "").trim()
}

/** The first Mermaid block in a model reply, if there is one. */
export function extractMermaid(text: string): string | null {
  const fences = [...text.matchAll(FENCE)]
  const tagged = fences.find((fence) => (fence[1] ?? "").trim().toLowerCase() === "mermaid")
  if (tagged) return fenceBody(tagged[2]) || null
  const inferred = fences.find((fence) => looksLikeMermaid(fenceBody(fence[2])))
  if (inferred) return fenceBody(inferred[2]) || null
  const bare = text.trim()
  return looksLikeMermaid(bare) ? bare : null
}

function cleanLabel(label: string): string {
  return label.replace(/^["'`]+|["'`]+$/g, "").trim()
}

export function parseDiagramLinks(text: string): DiagramLink[] {
  const links: DiagramLink[] = []
  for (const line of text.split("\n")) {
    const match = LINK_LINE.exec(line.trim())
    if (!match) continue
    const label = cleanLabel(match[1] ?? "")
    const seconds = parseTimestamp(match[2] ?? "")
    if (!label || seconds === null) continue
    links.push({ label, seconds })
  }
  return links
}

/** Pull the diagram source and the timestamp list out of a model reply. */
export function parseDiagramResponse(text: string): { code: string | null; links: DiagramLink[] } {
  const normalized = text.replace(/\r\n/g, "\n")
  const code = extractMermaid(normalized)
  const outside = normalized.replace(FENCE, "")
  return { code, links: parseDiagramLinks(outside) }
}

/** First line of a Mermaid parser error, for the panel. The model still gets the full text. */
export function shortMermaidError(error: string): string {
  const line = error
    .split("\n")
    .map((part) => part.trim())
    .find(Boolean)
  if (!line) return "Mermaid could not parse this diagram."
  return line.replace(/:$/, "")
}
