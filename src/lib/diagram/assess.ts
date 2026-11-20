import type { DiagramLink } from "@/lib/types"
import { parseDiagramResponse, shortMermaidError } from "./parse"

export type MermaidValidation = { ok: true } | { ok: false; error: string }

export type DiagramVerdict =
  | { status: "ok"; code: string; links: DiagramLink[] }
  | { status: "retry"; code: string; error: string; links: DiagramLink[] }
  | { status: "invalid"; message: string; code: string | null; raw: string }

const NO_DIAGRAM = "The model did not return a Mermaid diagram."

export async function assessDiagram(
  raw: string,
  alreadyRetried: boolean,
  validate: (code: string) => Promise<MermaidValidation>,
): Promise<DiagramVerdict> {
  const { code, links } = parseDiagramResponse(raw)
  if (!code) return { status: "invalid", message: NO_DIAGRAM, code: null, raw }
  const result = await validate(code)
  if (result.ok) return { status: "ok", code, links }
  if (!alreadyRetried) return { status: "retry", code, error: result.error, links }
  return { status: "invalid", message: shortMermaidError(result.error), code, raw }
}

export type DiagramOutcome = Exclude<DiagramVerdict, { status: "retry" }>

/**
 * Parse the reply. When Mermaid rejects it, ask the model to fix the syntax once.
 * A second rejection is returned as an error instead of looping.
 */
export async function resolveDiagram(
  raw: string,
  validate: (code: string) => Promise<MermaidValidation>,
  repair: (input: { code: string; error: string }) => Promise<string>,
): Promise<DiagramOutcome> {
  const first = await assessDiagram(raw, false, validate)
  if (first.status !== "retry") return first
  const secondRaw = await repair({ code: first.code, error: first.error })
  const second = await assessDiagram(secondRaw, true, validate)
  if (second.status === "retry") {
    return {
      status: "invalid",
      message: shortMermaidError(second.error),
      code: second.code,
      raw: secondRaw,
    }
  }
  if (second.status === "ok" && second.links.length === 0 && first.links.length > 0) {
    return { ...second, links: first.links }
  }
  return second
}
