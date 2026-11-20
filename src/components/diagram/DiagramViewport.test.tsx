import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DiagramViewport } from "./DiagramViewport"

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

function pointer(type: string, x: number, y: number) {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    pointerId: 1,
    button: 0,
    pointerType: "mouse",
  })
}

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("DiagramViewport", () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub)
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  async function render(onActivate = vi.fn()) {
    await act(async () => {
      root.render(
        <DiagramViewport diagramKey="flow" anchorRef={{ current: null }} onActivate={onActivate}>
          <svg viewBox="0 0 800 400" width="800" height="400" role="img" aria-label="API">
            <title>API</title>
            <g id="recapDiagram1-flowchart-A-0">
              <text>API</text>
            </g>
          </svg>
        </DiagramViewport>,
      )
    })
    const canvas = container.querySelector("[data-testid='diagram-canvas']")
    if (!(canvas instanceof HTMLDivElement)) throw new Error("missing canvas")
    return { canvas, onActivate }
  }

  it("shows Fit as the starting control and zooms around the cursor", async () => {
    const { canvas } = await render()
    expect(container.querySelector("[data-testid='diagram-zoom-toolbar']")?.textContent).toContain(
      "Fit",
    )
    expect(container.textContent).toContain("100%")
    expect(container.textContent).toContain("Fullscreen")
    const content = canvas.querySelector("[data-testid='diagram-zoom-content']")
    if (!(content instanceof HTMLElement)) throw new Error("missing content")
    canvas.getBoundingClientRect = () =>
      ({
        left: 10,
        top: 20,
        right: 410,
        bottom: 320,
        width: 400,
        height: 300,
        x: 10,
        y: 20,
        toJSON() {},
      }) as DOMRect
    await act(async () => {
      canvas.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          clientX: 110,
          clientY: 70,
          deltaY: -100,
          ctrlKey: true,
        }),
      )
    })
    const zoomed = content.style.transform
    expect(zoomed).not.toBe("translate(0px, 0px) scale(1)")
    expect(zoomed).toMatch(/scale\((?!1\))/)
    const plain = content.style.transform
    await act(async () => {
      canvas.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          clientX: 110,
          clientY: 70,
          deltaY: 40,
          ctrlKey: false,
        }),
      )
    })
    expect(content.style.transform).toBe(plain)
  })

  it("treats a short press as a click and a longer move as a pan", async () => {
    const onActivate = vi.fn()
    const { canvas } = await render(onActivate)
    const node = canvas.querySelector("text")
    if (!(node instanceof Element)) throw new Error("missing node")
    const content = canvas.querySelector("[data-testid='diagram-zoom-content']")
    if (!(content instanceof HTMLElement)) throw new Error("missing content")

    await act(async () => {
      node.dispatchEvent(pointer("pointerdown", 40, 40))
      node.dispatchEvent(pointer("pointerup", 42, 41))
    })
    expect(onActivate).toHaveBeenCalledTimes(1)
    expect(onActivate.mock.calls[0]?.[0]).toBe(node)
    const parked = content.style.transform

    await act(async () => {
      node.dispatchEvent(pointer("pointerdown", 40, 40))
      canvas.dispatchEvent(pointer("pointermove", 48, 40))
      canvas.dispatchEvent(pointer("pointerup", 48, 40))
    })
    expect(onActivate).toHaveBeenCalledTimes(1)
    expect(content.style.transform).not.toBe(parked)
    expect(content.style.transform).toContain("translate(")
  })

  it("opens a fullscreen overlay and closes it with Escape", async () => {
    await render()
    const button = [...container.querySelectorAll("button")].find((item) =>
      item.textContent?.includes("Fullscreen"),
    )
    if (!button) throw new Error("missing fullscreen button")
    await act(async () => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })
    const overlay = [...document.querySelectorAll("*")]
      .map((el) => el.shadowRoot?.querySelector("[data-testid='diagram-fullscreen']"))
      .find(Boolean)
    expect(overlay).not.toBeUndefined()
    expect((overlay as HTMLElement).style.position).toBe("fixed")
    expect((overlay as HTMLElement).style.inset).toBe("0px")
    expect(document.querySelector("[data-recap-fullscreen-host]")).not.toBeNull()
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    })
    expect(document.querySelector("[data-recap-fullscreen-host]")).toBeNull()
  })
})
