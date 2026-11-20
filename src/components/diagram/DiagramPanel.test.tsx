import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ToastProvider } from "@/components/shell/ToastContext"
import { DiagramResult } from "./DiagramPanel"

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

const svg = `<svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg"><g id="recapDiagram1-flowchart-A-0"><text>API Gateway</text></g></svg>`

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
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

describe("DiagramResult node menu", () => {
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

  async function render() {
    await act(async () => {
      root.render(
        <ToastProvider>
          <DiagramResult
            svg={svg}
            code={'flowchart TD\n  A["API Gateway"]'}
            links={[{ label: "API Gateway", seconds: 12 }]}
            title="Gateway"
            interactive={{ dark: false, onExplain() {}, onAsk() {} }}
          />
        </ToastProvider>,
      )
    })
  }

  it("opens the node menu on a click and pans instead when the pointer moves past 4px", async () => {
    await render()
    const text = container.querySelector("text")
    if (!(text instanceof Element)) throw new Error("missing node")
    await act(async () => {
      text.dispatchEvent(pointer("pointerdown", 20, 20))
      text.dispatchEvent(pointer("pointerup", 22, 21))
    })
    const menu = document.querySelector("[data-testid='diagram-node-menu']")
    expect(menu?.textContent).toContain("Giải thích node này")
    expect(menu?.textContent).toContain("Xem đoạn video")
    expect(menu?.textContent).toContain("Hỏi thầy")

    await act(async () => {
      text.dispatchEvent(pointer("pointerdown", 20, 20))
      text.dispatchEvent(pointer("pointermove", 30, 20))
      text.dispatchEvent(pointer("pointerup", 30, 20))
    })
    expect(document.querySelector("[data-testid='diagram-node-menu']")).toBeNull()
  })
})
