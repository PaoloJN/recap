import { useRef } from "react"
import { PANEL_MIN_PX, widthFromDrag, widthFromKey } from "@/lib/layout/panel-layout"

export interface ResizeHandleProps {
  widthPx: number
  maxPx: number
  onPreview(width: number): void
  onCommit(width: number): void
  onReset(): void
}

export function ResizeHandle({ widthPx, maxPx, onPreview, onCommit, onReset }: ResizeHandleProps) {
  const drag = useRef<{
    pointerId: number
    startX: number
    startWidth: number
    latestX: number
    frame: number
  } | null>(null)

  const finish = (clientX: number) => {
    const current = drag.current
    if (!current) return
    if (current.frame) cancelAnimationFrame(current.frame)
    drag.current = null
    onCommit(widthFromDrag(current.startWidth, current.startX, clientX, window.innerWidth))
  }

  return (
    <hr
      tabIndex={0}
      aria-orientation="vertical"
      aria-label="Resize panel"
      aria-valuemin={PANEL_MIN_PX}
      aria-valuemax={maxPx}
      aria-valuenow={widthPx}
      aria-valuetext={`${widthPx} pixels`}
      title="Drag to resize. Double-click to reset."
      className="absolute inset-y-0 left-0 z-30 m-0 h-auto w-[12px] cursor-col-resize touch-none appearance-none border-0 bg-transparent p-0 outline-none before:absolute before:inset-y-[8px] before:left-1/2 before:w-[2px] before:-translate-x-1/2 before:rounded-full before:bg-transparent before:transition-colors before:duration-150 before:content-[''] hover:before:bg-foreground/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:before:bg-foreground/55"
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        drag.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startWidth: widthPx,
          latestX: event.clientX,
          frame: 0,
        }
        onPreview(widthPx)
      }}
      onPointerMove={(event) => {
        const current = drag.current
        if (!current || event.pointerId !== current.pointerId) return
        current.latestX = event.clientX
        if (current.frame) return
        const handle = event.currentTarget
        current.frame = requestAnimationFrame(() => {
          const latest = drag.current
          if (!latest) return
          latest.frame = 0
          const next = widthFromDrag(
            latest.startWidth,
            latest.startX,
            latest.latestX,
            window.innerWidth,
          )
          handle.setAttribute("aria-valuenow", String(next))
          handle.setAttribute("aria-valuetext", `${next} pixels`)
          onPreview(next)
        })
      }}
      onPointerUp={(event) => finish(event.clientX)}
      onPointerCancel={(event) => finish(event.clientX)}
      onDoubleClick={(event) => {
        event.preventDefault()
        onReset()
      }}
      onKeyDown={(event) => {
        const next = widthFromKey(widthPx, event.key, event.shiftKey, window.innerWidth)
        if (next === null) return
        event.preventDefault()
        onCommit(next)
      }}
    />
  )
}
