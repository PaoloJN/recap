import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import { reviewItem } from "@/lib/review"
import { ReviewPrompt } from "./ReviewPrompt"

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

const URL = "https://chromewebstore.google.com/detail/x/reviews"

describe("ReviewPrompt", () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    fakeBrowser.reset()
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  const render = async (storeUrl: string | null = URL) => {
    await act(async () => root.render(<ReviewPrompt storeUrl={storeUrl} />))
    await act(async () => {})
  }

  it("stays hidden before the third summary", async () => {
    await reviewItem.setValue({ summaries: 2, settled: false })
    await render()
    expect(container.querySelector("section")).toBeNull()
  })

  it("shows after the third summary with a link to the store", async () => {
    await reviewItem.setValue({ summaries: 3, settled: false })
    await render()
    expect(container.querySelector("a")?.getAttribute("href")).toBe(URL)
  })

  it("settles for good on Not now", async () => {
    await reviewItem.setValue({ summaries: 3, settled: false })
    await render()
    await act(async () => container.querySelector("button")?.click())
    expect(await reviewItem.getValue()).toEqual({ summaries: 3, settled: true })
    expect(container.querySelector("section")).toBeNull()
  })

  it("settles on Rate it too", async () => {
    await reviewItem.setValue({ summaries: 3, settled: false })
    await render()
    await act(async () => container.querySelector("a")?.click())
    expect((await reviewItem.getValue()).settled).toBe(true)
  })

  it("stays hidden without a store URL (Firefox)", async () => {
    await reviewItem.setValue({ summaries: 3, settled: false })
    await render(null)
    expect(container.querySelector("section")).toBeNull()
  })
})
