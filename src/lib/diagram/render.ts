import mermaid from "mermaid"
import { configureMermaid } from "./mermaid-setup"
import { mermaidErrorMessage, validateMermaid } from "./validate"

let seq = 0

function nextId(): string {
  seq += 1
  return `recapDiagram${seq}`
}

/** Render a diagram to an SVG string. Throws when the source is not valid Mermaid. */
export async function renderMermaidSvg(code: string, dark: boolean): Promise<string> {
  const checked = await validateMermaid(code)
  if (!checked.ok) throw new Error(checked.error)
  configureMermaid(dark)
  try {
    const { svg } = await mermaid.render(nextId(), code)
    if (/<\s*script/i.test(svg)) throw new Error("Diagram contained a script element.")
    return svg
  } catch (err) {
    throw new Error(mermaidErrorMessage(err))
  }
}
