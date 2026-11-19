import { useEffect, useRef, useState } from "react"
import { browser } from "wxt/browser"
import {
  DIAGRAM_PAGE,
  DIAGRAM_SOURCE,
  isDiagramNodeClick,
  isDiagramReady,
  isDiagramResult,
  isTrustedDiagramEvent,
} from "@/lib/diagram/protocol"

const RENDER_MS = 20_000

function extensionOrigin(): string {
  return new URL(browser.runtime.getURL(`/${DIAGRAM_PAGE}`)).origin
}

/** Visible renderer. Node clicks arrive as postMessage and are checked against origin and source. */
export function DiagramFrame({
  code,
  dark,
  onNode,
  onError,
}: {
  code: string
  dark: boolean
  onNode(domId: string, viewportX: number, viewportY: number): void
  onError(): void
}) {
  const ref = useRef<HTMLIFrameElement>(null)
  const onNodeRef = useRef(onNode)
  const onErrorRef = useRef(onError)
  onNodeRef.current = onNode
  onErrorRef.current = onError
  const [height, setHeight] = useState(240)

  useEffect(() => {
    const iframe = ref.current
    if (!iframe) return
    const origin = extensionOrigin()
    let disposed = false
    let seq = 0
    let stopResult = () => {}

    const onMessage = (event: MessageEvent) => {
      if (!isTrustedDiagramEvent(event, iframe.contentWindow, origin)) return
      if (!isDiagramNodeClick(event.data)) return
      const rect = iframe.getBoundingClientRect()
      onNodeRef.current(event.data.nodeId, rect.left + event.data.x, rect.top + event.data.y)
    }

    const render = () => {
      stopResult()
      seq += 1
      const id = `show${seq}`
      const timer = window.setTimeout(() => {
        if (!disposed) onErrorRef.current()
      }, RENDER_MS)
      const onResult = (event: MessageEvent) => {
        if (!isTrustedDiagramEvent(event, iframe.contentWindow, origin)) return
        if (!isDiagramResult(event.data) || event.data.id !== id) return
        window.clearTimeout(timer)
        window.removeEventListener("message", onResult)
        if (!event.data.ok) {
          if (!disposed) onErrorRef.current()
          return
        }
        if (typeof event.data.height === "number" && event.data.height > 0) {
          setHeight(Math.min(event.data.height + 8, 720))
        }
      }
      window.addEventListener("message", onResult)
      stopResult = () => {
        window.clearTimeout(timer)
        window.removeEventListener("message", onResult)
      }
      iframe.contentWindow?.postMessage(
        { source: DIAGRAM_SOURCE, type: "render", id, code, dark, interactive: true },
        origin,
      )
    }

    const onReady = (event: MessageEvent) => {
      if (!isTrustedDiagramEvent(event, iframe.contentWindow, origin)) return
      if (!isDiagramReady(event.data)) return
      iframe.dataset.ready = "1"
      window.removeEventListener("message", onReady)
      render()
    }

    window.addEventListener("message", onMessage)
    window.addEventListener("message", onReady)
    if (iframe.dataset.ready === "1") render()
    else if (!iframe.src) iframe.src = browser.runtime.getURL(`/${DIAGRAM_PAGE}`)

    return () => {
      disposed = true
      window.removeEventListener("message", onMessage)
      window.removeEventListener("message", onReady)
      stopResult()
    }
  }, [code, dark])

  return (
    <iframe
      ref={ref}
      title="Diagram of the video"
      data-testid="diagram-frame"
      className="w-full rounded-[12px] border bg-card"
      style={{ height }}
    />
  )
}
