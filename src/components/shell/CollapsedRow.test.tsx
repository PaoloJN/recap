import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CollapsedRow } from "./CollapsedRow"
import { collapsedStatus } from "./collapsed-status"

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

describe("CollapsedRow", () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it("shows the status text and expands on click", () => {
    const onExpand = vi.fn()
    const status = collapsedStatus({
      hasKey: true,
      pageError: false,
      transcript: "unavailable",
      summary: "idle",
      style: "detailed",
      momentCount: 0,
    })
    act(() => root.render(<CollapsedRow status={status} onExpand={onExpand} />))
    const button = container.querySelector("button")
    expect(button?.textContent).toContain("No captions on this video")
    expect(button?.textContent).toContain("⌥ Y")
    act(() => button?.click())
    expect(onExpand).toHaveBeenCalledOnce()
  })
})
