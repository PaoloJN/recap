import { DIAGRAM_SOURCE } from "@/lib/diagram/protocol"
import { renderMermaidSvg } from "@/lib/diagram/render"
import { validateMermaid } from "@/lib/diagram/validate"

// Extension page so Mermaid's chunks load from chrome-extension:// (MV3 content scripts cannot
// fetch them off youtube.com) and so rendering is outside the page's Trusted Types policy.

function parentOrigin(): string {
  try {
    return new URL(document.referrer).origin
  } catch {
    return "*"
  }
}

function isYouTube(origin: string): boolean {
  try {
    return new URL(origin).hostname === "www.youtube.com"
  } catch {
    return false
  }
}

document.body.style.margin = "0"

const target = parentOrigin()

window.addEventListener("message", (event) => {
  if (event.source !== window.parent || !isYouTube(event.origin)) return
  const data = event.data as {
    source?: string
    type?: string
    id?: string
    code?: string
    dark?: boolean
  }
  if (
    data?.source !== DIAGRAM_SOURCE ||
    typeof data.id !== "string" ||
    typeof data.code !== "string"
  ) {
    return
  }
  const id = data.id
  const code = data.code
  const reply = (body: { ok: boolean; svg?: string; error?: string }) => {
    window.parent.postMessage({ source: DIAGRAM_SOURCE, type: "result", id, ...body }, event.origin)
  }
  void (async () => {
    try {
      if (data.type === "parse") {
        const result = await validateMermaid(code)
        reply(result.ok ? { ok: true } : { ok: false, error: result.error })
        return
      }
      if (data.type === "render") {
        reply({ ok: true, svg: await renderMermaidSvg(code, data.dark === true) })
      }
    } catch (err) {
      reply({
        ok: false,
        error: err instanceof Error ? err.message : "Couldn't render this diagram.",
      })
    }
  })()
})

window.parent.postMessage({ source: DIAGRAM_SOURCE, type: "ready" }, target)
