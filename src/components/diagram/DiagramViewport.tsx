import { CornersIn, CornersOut, Minus, Plus } from "@phosphor-icons/react"
import {
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"
import css from "@/assets/tailwind.css?inline"
import {
  type DiagramView,
  fitWidth,
  isZoomWheel,
  movedPastThreshold,
  panBy,
  zoomAt,
} from "@/lib/diagram/zoom"
import { cn } from "@/lib/utils"

const STEP = 1.25
const INLINE_MIN = 160
const INLINE_MAX = 520

interface Drag {
  pointerId: number
  x: number
  y: number
  originX: number
  originY: number
  moved: boolean
  target: Element | null
}

function contentSize(content: HTMLElement): { width: number; height: number } {
  const svg = content.querySelector("svg")
  if (svg instanceof SVGSVGElement) {
    const box = svg.viewBox.baseVal
    if (box.width > 0 && box.height > 0) return { width: box.width, height: box.height }
  }
  return { width: content.offsetWidth, height: content.offsetHeight }
}

const toolButton =
  "inline-flex h-[28px] min-w-[28px] cursor-pointer items-center justify-center gap-[4px] rounded-[8px] px-[8px] text-[12px] leading-[16px] font-medium text-foreground outline-none hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg]:size-[14px]"

export function DiagramViewport({
  diagramKey,
  menu,
  anchorRef,
  onActivate,
  children,
}: {
  diagramKey: string
  menu?: ReactNode
  anchorRef: RefObject<HTMLDivElement | null>
  onActivate?(target: Element, clientX: number, clientY: number): void
  children: ReactNode
}) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const fittedKey = useRef<string | null>(null)
  const fittedWidth = useRef(0)
  const [canvasNode, setCanvasNode] = useState<HTMLDivElement | null>(null)
  const [view, setView] = useState<DiagramView>({ scale: 1, x: 0, y: 0 })
  const [intrinsic, setIntrinsic] = useState({ width: 0, height: 0 })
  const [fullscreen, setFullscreen] = useState(false)
  const fullscreenMount = useFullscreenMount(fullscreen)
  const [dragging, setDragging] = useState(false)

  const assignCanvas = (node: HTMLDivElement | null) => {
    canvasRef.current = node
    anchorRef.current = node
    setCanvasNode((current) => (current === node ? current : node))
  }

  useEffect(() => {
    const content = contentRef.current
    if (!content || !canvasNode) return
    const apply = () => {
      const size = contentSize(content)
      const width = canvasNode.clientWidth
      if (!(size.width > 0) || !(width > 0)) return
      if (fittedKey.current === diagramKey && Math.abs(fittedWidth.current - width) < 2) return
      fittedKey.current = diagramKey
      fittedWidth.current = width
      setIntrinsic(size)
      setView(fitWidth(width, size.width))
    }
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(content)
    observer.observe(canvasNode)
    return () => observer.disconnect()
  }, [diagramKey, canvasNode])

  useEffect(() => {
    if (!canvasNode) return
    const onWheel = (event: WheelEvent) => {
      if (!isZoomWheel(event)) return
      event.preventDefault()
      const rect = canvasNode.getBoundingClientRect()
      const cursorX = event.clientX - rect.left - canvasNode.clientLeft
      const cursorY = event.clientY - rect.top - canvasNode.clientTop
      const factor = Math.exp(-event.deltaY * 0.0015)
      setView((current) => zoomAt(current, cursorX, cursorY, current.scale * factor))
    }
    canvasNode.addEventListener("wheel", onWheel, { passive: false })
    return () => canvasNode.removeEventListener("wheel", onWheel)
  }, [canvasNode])

  // biome-ignore lint/correctness/useExhaustiveDependencies: fullscreen changes the canvas size without changing the node
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const content = contentRef.current
      const canvas = canvasRef.current
      if (!content || !canvas) return
      const size = contentSize(content)
      if (!(size.width > 0) || !(canvas.clientWidth > 0)) return
      fittedKey.current = diagramKey
      setIntrinsic(size)
      setView(fitWidth(canvas.clientWidth, size.width))
    })
    return () => cancelAnimationFrame(frame)
  }, [fullscreen, diagramKey])

  useEffect(() => {
    if (!fullscreen) return
    const root = canvasRef.current?.getRootNode()
    const host = root instanceof ShadowRoot ? (root.host as HTMLElement) : null
    // The host is its own stacking context, so the overlay cannot cover the masthead
    // until the host itself sits above it.
    document.documentElement.classList.add("recap-diagram-open")
    host?.style.setProperty("overflow", "visible", "important")
    host?.style.setProperty("z-index", "2147483646", "important")
    return () => {
      document.documentElement.classList.remove("recap-diagram-open")
      if (!host) return
      if (document.documentElement.classList.contains("recap-focus")) {
        host.style.setProperty("overflow", "hidden", "important")
        host.style.setProperty("z-index", "2", "important")
      } else {
        host.style.removeProperty("overflow")
        host.style.removeProperty("z-index")
      }
    }
  }, [fullscreen])

  useEffect(() => {
    if (!fullscreen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      const root = event.target instanceof Node ? event.target.getRootNode() : null
      const shadow = root instanceof ShadowRoot ? root : document
      if (shadow.querySelector("[data-testid='diagram-node-menu']")) return
      event.preventDefault()
      event.stopPropagation()
      setFullscreen(false)
    }
    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [fullscreen])

  const zoomBy = (factor: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    setView((current) =>
      zoomAt(current, canvas.clientWidth / 2, canvas.clientHeight / 2, current.scale * factor),
    )
  }

  const fitToWidth = () => {
    const canvas = canvasRef.current
    const content = contentRef.current
    if (!canvas || !content) return
    const size = contentSize(content)
    if (!(size.width > 0)) return
    setIntrinsic(size)
    setView(fitWidth(canvas.clientWidth, size.width))
  }

  const actualSize = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    setView((current) => zoomAt(current, canvas.clientWidth / 2, canvas.clientHeight / 2, 1))
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const target = event.target instanceof Element ? event.target : null
    if (target?.closest("[data-testid='diagram-node-menu']")) return
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      originX: event.clientX,
      originY: event.clientY,
      moved: false,
      target,
    }
    if (typeof event.currentTarget.setPointerCapture === "function") {
      event.currentTarget.setPointerCapture(event.pointerId)
    }
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (!drag.moved) {
      if (!movedPastThreshold(event.clientX - drag.originX, event.clientY - drag.originY)) return
      drag.moved = true
      setDragging(true)
    }
    const dx = event.clientX - drag.x
    const dy = event.clientY - drag.y
    drag.x = event.clientX
    drag.y = event.clientY
    setView((current) => panBy(current, dx, dy))
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    setDragging(false)
    if (drag.moved || !drag.target) return
    onActivate?.(drag.target, event.clientX, event.clientY)
  }

  const rawHeight = intrinsic.height > 0 ? intrinsic.height * view.scale : 180
  const inlineHeight = Math.round(Math.min(INLINE_MAX, Math.max(INLINE_MIN, rawHeight)))

  const chrome = (
    <div className={cn("flex flex-col gap-[8px]", fullscreen && "h-full min-h-0 w-full")}>
      <div className="flex flex-wrap items-center gap-[4px]" data-testid="diagram-zoom-toolbar">
        <button
          type="button"
          className={toolButton}
          aria-label="Zoom in"
          onClick={() => zoomBy(STEP)}
        >
          <Plus aria-hidden />
        </button>
        <button
          type="button"
          className={toolButton}
          aria-label="Zoom out"
          onClick={() => zoomBy(1 / STEP)}
        >
          <Minus aria-hidden />
        </button>
        <button type="button" className={toolButton} onClick={fitToWidth}>
          Fit
        </button>
        <button type="button" className={toolButton} onClick={actualSize}>
          100%
        </button>
        <button
          type="button"
          className={cn(toolButton, "ml-auto")}
          aria-pressed={fullscreen}
          onClick={() => setFullscreen((open) => !open)}
        >
          {fullscreen ? <CornersIn aria-hidden /> : <CornersOut aria-hidden />}
          {fullscreen ? "Close" : "Fullscreen"}
        </button>
      </div>
      <div
        ref={assignCanvas}
        data-testid="diagram-canvas"
        className={cn(
          "relative overflow-hidden rounded-[12px] border bg-card select-none",
          dragging ? "cursor-grabbing" : "cursor-grab",
        )}
        style={fullscreen ? { flex: "1 1 auto", minHeight: 0 } : { height: inlineHeight }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          ref={contentRef}
          data-testid="diagram-zoom-content"
          className="w-max"
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            transformOrigin: "0 0",
          }}
        >
          {children}
        </div>
      </div>
      {menu}
    </div>
  )

  if (!fullscreen || !fullscreenMount) return chrome
  return createPortal(
    <div
      data-testid="diagram-fullscreen"
      role="dialog"
      aria-modal="true"
      aria-label="Diagram"
      className="fixed inset-0 z-[2147483000] flex flex-col bg-background p-[16px]"
      style={{ position: "fixed", inset: 0, zIndex: 2147483000 }}
    >
      {chrome}
    </div>,
    fullscreenMount,
  )
}

/** Fullscreen has to leave the panel host. That host is its own stacking context, under the masthead. */
function useFullscreenMount(open: boolean): HTMLElement | null {
  const [mount, setMount] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (!open) return
    const host = document.createElement("div")
    host.dataset.recapFullscreenHost = "true"
    host.style.cssText = "position:fixed;inset:0;z-index:2147483646"
    const shadow = host.attachShadow({ mode: "open" })
    const style = document.createElement("style")
    style.textContent = css
    const node = document.createElement("div")
    node.style.height = "100%"
    const card = document
      .querySelector("recap-panel")
      ?.shadowRoot?.querySelector("[data-recap-card]")
    if (card?.classList.contains("dark")) node.classList.add("dark")
    shadow.append(style, node)
    document.body.append(host)
    setMount(node)
    return () => {
      host.remove()
      setMount(null)
    }
  }, [open])
  return mount
}
