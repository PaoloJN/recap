import mermaid from "mermaid"
import { configureMermaid } from "./mermaid-setup"

/** Directives that can change Mermaid's security settings or run code. */
export function unsafeMermaidReason(code: string): string | null {
  if (/%%\{/.test(code)) return "Diagram contains a Mermaid init directive."
  if (/<\s*script/i.test(code)) return "Diagram contains a script element."
  if (/javascript:/i.test(code)) return "Diagram contains a javascript URL."
  if (/^\s*click\s+/m.test(code)) return "Diagram contains a click directive."
  return null
}

export function mermaidErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message.trim()
  if (typeof err === "string" && err.trim()) return err.trim()
  return "Mermaid could not parse this diagram."
}

/** True when Mermaid accepts the source. Does not render. */
export async function validateMermaid(
  code: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const unsafe = unsafeMermaidReason(code)
  if (unsafe) return { ok: false, error: unsafe }
  configureMermaid(false)
  try {
    await mermaid.parse(code)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: mermaidErrorMessage(err) }
  }
}
