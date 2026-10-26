import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { seekTo } from "@/lib/youtube/player"
import { ChapterBar } from "./ChapterBar"
import { ToastProvider } from "./ToastContext"

vi.mock("@/lib/youtube/player", () => ({ seekTo: vi.fn() }))

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

const CHAPTERS = [
  { seconds: 0, title: "Intro" },
  { seconds: 30, title: "Setup" },
  { seconds: 90, title: "Wrap-up" },
]

describe("ChapterBar", () => {
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

  const render = (ms: number) =>
    act(() => {
      root.render(
        <ToastProvider>
          <ChapterBar chapters={CHAPTERS} durationSeconds={120} ms={ms} />
        </ToastProvider>,
      )
    })

  const segments = () => Array.from(container.querySelectorAll<HTMLElement>("[data-chapter]"))

  it("renders one segment per chapter, sized by length", () => {
    render(60_000)
    const segs = segments()
    expect(segs).toHaveLength(3)
    expect(segs.map((s) => s.style.flexGrow)).toEqual(["30", "60", "30"])
    expect(segs[1]?.title).toBe("Setup · 0:30")
  })

  it("fills the playing chapter proportionally", () => {
    render(60_000)
    const fills = segments().map((s) => s.querySelector<HTMLElement>("[data-fill]")?.style.width)
    expect(fills).toEqual(["100%", "50%", "0%"])
  })

  it("seeks to the chapter start on click and shows a toast", () => {
    render(0)
    act(() => {
      segments()[2]?.click()
    })
    expect(seekTo).toHaveBeenCalledWith(90)
    expect(container.textContent).toContain("Jumped to 1:30")
  })
})
