import { browser } from "wxt/browser"
import { DIAGRAM_PAGE, DIAGRAM_SOURCE, isDiagramReady, isDiagramResult } from "./protocol"

const LOAD_MS = 15_000
const RENDER_MS = 20_000

export class DiagramBridgeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DiagramBridgeError"
  }
}

let frame: HTMLIFrameElement | null = null
let tail: Promise<void> = Promise.resolve()
let seq = 0

function extensionOrigin(): string {
  return new URL(browser.runtime.getURL(`/${DIAGRAM_PAGE}`)).origin
}

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = tail.then(job, job)
  tail = run.then(
    () => {},
    () => {},
  )
  return run
}

function waitUntilReady(iframe: HTMLIFrameElement): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new DiagramBridgeError("The diagram renderer took too long to load."))
    }, LOAD_MS)
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return
      if (!isDiagramReady(event.data)) return
      cleanup()
      resolve()
    }
    const cleanup = () => {
      clearTimeout(timer)
      window.removeEventListener("message", onMessage)
    }
    window.addEventListener("message", onMessage)
  })
}

async function ensureFrame(): Promise<HTMLIFrameElement> {
  if (frame?.isConnected && frame.contentWindow) return frame
  frame?.remove()
  const iframe = document.createElement("iframe")
  iframe.dataset.recapDiagram = "1"
  iframe.title = "Diagram renderer"
  iframe.setAttribute("aria-hidden", "true")
  iframe.tabIndex = -1
  // Off-screen but laid out, so Mermaid's text measurement (getBBox) is non-zero.
  // Rendering happens in an extension page: the content-script bundle cannot fetch Mermaid's
  // chunks from youtube.com, and the page's Trusted Types policy rejects Mermaid's DOM writes.
  iframe.style.cssText =
    "position:fixed;left:0;top:0;width:960px;height:800px;border:0;transform:translateX(-100vw);pointer-events:none"
  const ready = waitUntilReady(iframe)
  document.documentElement.appendChild(iframe)
  iframe.src = browser.runtime.getURL(`/${DIAGRAM_PAGE}`)
  try {
    await ready
  } catch (err) {
    iframe.remove()
    frame = null
    throw err
  }
  frame = iframe
  return iframe
}

interface CallResult {
  ok: boolean
  svg?: string
  error?: string
}

function callFrame(
  iframe: HTMLIFrameElement,
  body: { type: "parse"; code: string } | { type: "render"; code: string; dark: boolean },
): Promise<CallResult> {
  seq += 1
  const id = `d${seq}`
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      window.removeEventListener("message", onMessage)
      reject(new DiagramBridgeError("The diagram renderer did not respond."))
    }, RENDER_MS)
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return
      if (!isDiagramResult(event.data) || event.data.id !== id) return
      clearTimeout(timer)
      window.removeEventListener("message", onMessage)
      resolve({ ok: event.data.ok, svg: event.data.svg, error: event.data.error })
    }
    window.addEventListener("message", onMessage)
    iframe.contentWindow?.postMessage({ source: DIAGRAM_SOURCE, id, ...body }, extensionOrigin())
  })
}

export function parseDiagram(code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  return enqueue(async () => {
    const iframe = await ensureFrame()
    const result = await callFrame(iframe, { type: "parse", code })
    if (result.ok) return { ok: true }
    return { ok: false, error: result.error || "Mermaid could not parse this diagram." }
  })
}

export function renderDiagram(code: string, dark: boolean): Promise<string> {
  return enqueue(async () => {
    const iframe = await ensureFrame()
    const result = await callFrame(iframe, { type: "render", code, dark })
    if (result.ok && result.svg) return result.svg
    throw new DiagramBridgeError(result.error || "Couldn't render this diagram.")
  })
}
