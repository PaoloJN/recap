import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { readTextFromUIStream } from "@/lib/transport"
import type { VideoContext } from "@/lib/types"
import { summaryCache, summaryCacheKey } from "./summary-cache"
import { type SummaryState, useSummary } from "./useSummary"

vi.mock("@/lib/transport", () => ({
  openStream: vi.fn(() => new ReadableStream()),
  readTextFromUIStream: vi.fn(),
}))

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

const ctx: VideoContext = {
  metadata: { videoId: "vid", title: "T", author: "A", durationSeconds: 60 },
  transcript: [{ text: "hi", startMs: 0, endMs: 1000 }],
  language: "en",
}
const selection = { provider: "openai", model: "gpt-6-luna" } as const

let state: SummaryState

function Probe() {
  state = useSummary(ctx, selection)
  return null
}

describe("useSummary", () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    summaryCache.clear()
    container = document.createElement("div")
    root = createRoot(container)
    await act(async () => root.render(<Probe />))
  })

  afterEach(() => {
    act(() => root.unmount())
    vi.mocked(readTextFromUIStream).mockReset()
  })

  it("returns to idle and caches nothing on an empty completion", async () => {
    vi.mocked(readTextFromUIStream).mockResolvedValue("")
    await act(async () => state.generate())
    expect(state.status).toBe("idle")
    expect(summaryCache.has(summaryCacheKey("vid", "tldr"))).toBe(false)
  })

  it("returns to idle when stopped before any text arrived", async () => {
    let reject: (e: unknown) => void = () => {}
    vi.mocked(readTextFromUIStream).mockReturnValue(
      new Promise<string>((_, r) => {
        reject = r
      }),
    )
    await act(async () => state.generate())
    expect(state.status).toBe("streaming")
    await act(async () => {
      state.stop()
      reject(new DOMException("aborted", "AbortError"))
    })
    expect(state.status).toBe("idle")
    expect(state.text).toBe("")
  })

  it("caches and shows a normal completion", async () => {
    vi.mocked(readTextFromUIStream).mockResolvedValue("Summary")
    await act(async () => state.generate())
    expect(state.status).toBe("done")
    expect(state.text).toBe("Summary")
    expect(summaryCache.get(summaryCacheKey("vid", "tldr"))).toBe("Summary")
  })
})
