import { clickedNodeId } from "@/lib/diagram/graph"
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
let parentTarget: string | null = isYouTube(target) ? target : null

function stripSvg(svg: string): Element | null {
  const parsed = new DOMParser().parseFromString(svg, "image/svg+xml")
  const root = parsed.documentElement
  if (root.nodeName.toLowerCase() !== "svg") return null
  for (const script of root.querySelectorAll("script")) script.remove()
  for (const el of [root, ...root.querySelectorAll("*")]) {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase()
      if (name.startsWith("on")) el.removeAttribute(attr.name)
    }
  }
  return root
}

function mountSvg(svg: string): SVGSVGElement | null {
  const root = stripSvg(svg)
  document.body.replaceChildren()
  if (!root) return null
  const node = document.importNode(root, true)
  if (!(node instanceof SVGSVGElement)) return null
  node.style.maxWidth = "100%"
  node.style.height = "auto"
  node.setAttribute("width", "100%")
  document.body.append(node)
  return node
}

function svgHeight(svg: SVGSVGElement): number {
  const box = svg.viewBox.baseVal
  const width = svg.getBoundingClientRect().width || box.width
  if (box.width > 0 && width > 0) return Math.ceil((box.height / box.width) * width)
  const attr = Number(svg.getAttribute("height"))
  return Number.isFinite(attr) && attr > 0 ? Math.ceil(attr) : 240
}

document.addEventListener("click", (event) => {
  if (!parentTarget) return
  const targetNode = event.target instanceof Element ? event.target : null
  const nodeId = clickedNodeId(targetNode)
  if (!nodeId) return
  window.parent.postMessage(
    {
      source: DIAGRAM_SOURCE,
      type: "node-click",
      nodeId,
      x: event.clientX,
      y: event.clientY,
    },
    parentTarget,
  )
})

window.addEventListener("message", (event) => {
  if (event.source !== window.parent || !isYouTube(event.origin)) return
  const data = event.data as {
    source?: string
    type?: string
    id?: string
    code?: string
    dark?: boolean
    interactive?: boolean
  }
  if (isYouTube(event.origin)) parentTarget = event.origin
  if (
    data?.source !== DIAGRAM_SOURCE ||
    typeof data.id !== "string" ||
    typeof data.code !== "string"
  ) {
    return
  }
  const id = data.id
  const code = data.code
  const reply = (body: { ok: boolean; svg?: string; error?: string; height?: number }) => {
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
        const svg = await renderMermaidSvg(code, data.dark === true)
        if (data.interactive === true) {
          const mounted = mountSvg(svg)
          requestAnimationFrame(() => {
            reply({ ok: true, svg, height: mounted ? svgHeight(mounted) : undefined })
          })
          return
        }
        reply({ ok: true, svg })
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
