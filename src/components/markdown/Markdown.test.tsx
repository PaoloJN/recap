import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ToastProvider } from "@/components/shell/ToastContext"
import { seekTo } from "@/lib/youtube/player"
import { Markdown } from "./Markdown"

vi.mock("@/lib/youtube/player", () => ({ seekTo: vi.fn() }))

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

describe("Markdown", () => {
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
    vi.mocked(seekTo).mockClear()
  })

  it("renders timestamps as anchors that seek the player on click", async () => {
    await act(async () => {
      root.render(
        <ToastProvider>
          <Markdown>see 12:34</Markdown>
        </ToastProvider>,
      )
    })
    const anchor = container.querySelector<HTMLAnchorElement>('a[href="#t=754"]')
    expect(anchor).not.toBeNull()
    const click = new MouseEvent("click", { bubbles: true, cancelable: true })
    act(() => {
      anchor?.dispatchEvent(click)
    })
    expect(seekTo).toHaveBeenCalledWith(754)
    expect(click.defaultPrevented).toBe(true)
  })

  it("keeps ordinary links as new-tab links", async () => {
    await act(async () => {
      root.render(
        <ToastProvider>
          <Markdown>[docs](https://example.com)</Markdown>
        </ToastProvider>,
      )
    })
    const anchor = container.querySelector<HTMLAnchorElement>('a[href^="https://example.com"]')
    expect(anchor?.target).toBe("_blank")
  })
})
