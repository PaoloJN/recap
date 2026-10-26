import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import { DEFAULT_SETTINGS, type Settings, summariesItem } from "@/lib/storage"
import { openStream, readTextFromUIStream } from "@/lib/transport"
import type { VideoContext } from "@/lib/types"
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
let settings: Settings = DEFAULT_SETTINGS
let enabled = false

function Probe() {
  state = useSummary(ctx, selection, settings, enabled)
  return null
}

const flush = () => act(async () => {})

describe("useSummary", () => {
  let container: HTMLDivElement
  let root: Root
  const mount = async () => {
    container = document.createElement("div")
    root = createRoot(container)
    await act(async () => root.render(<Probe />))
    await flush()
  }

  beforeEach(async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    fakeBrowser.reset()
    settings = DEFAULT_SETTINGS
    enabled = false
    vi.mocked(openStream).mockClear()
  })

  afterEach(() => {
    act(() => root.unmount())
    vi.mocked(readTextFromUIStream).mockReset()
  })

  it("returns to idle and stores nothing on an empty completion", async () => {
    await mount()
    vi.mocked(readTextFromUIStream).mockResolvedValue("")
    await act(async () => state.generate())
    expect(state.status).toBe("idle")
    expect(await summariesItem.getValue()).toEqual({})
  })

  it("returns to idle when stopped before any text arrived", async () => {
    await mount()
    let reject: (e: unknown) => void = () => {}
    vi.mocked(readTextFromUIStream).mockReturnValue(
      new Promise<string>((_, r) => {
        reject = r
      }),
    )
    await act(async () => state.generate())
    expect(state.status).toBe("streaming")
    expect(state.receivedFirstToken).toBe(false)
    await act(async () => {
      state.stop()
      reject(new DOMException("aborted", "AbortError"))
    })
    expect(state.status).toBe("idle")
    expect(state.text).toBe("")
  })

  it("stores and shows a normal completion", async () => {
    await mount()
    vi.mocked(readTextFromUIStream).mockResolvedValue("Summary")
    await act(async () => state.generate())
    await flush()
    expect(state.status).toBe("done")
    expect(state.text).toBe("Summary")
    const saved = (await summariesItem.getValue()).vid
    expect(saved).toMatchObject({
      style: "detailed",
      model: "gpt-6-luna",
      language: "en",
      text: "Summary",
    })
  })

  it("flips receivedFirstToken on the first non-empty partial", async () => {
    await mount()
    vi.mocked(readTextFromUIStream).mockImplementation(async (_s, onText) => {
      onText?.("Hel")
      return await new Promise<string>(() => {})
    })
    await act(async () => state.generate())
    expect(state.receivedFirstToken).toBe(true)
    expect(state.status).toBe("streaming")
  })

  it("restores a stored summary as done", async () => {
    await summariesItem.setValue({
      vid: { style: "tldr", model: "m", language: "en", text: "Saved", createdAt: 1 },
    })
    await mount()
    expect(state.status).toBe("done")
    expect(state.text).toBe("Saved")
    expect(state.style).toBe("tldr")
    expect(openStream).not.toHaveBeenCalled()
  })

  it("setStyle triggers a new request with that style", async () => {
    await mount()
    vi.mocked(readTextFromUIStream).mockResolvedValue("Out")
    await act(async () => state.setStyle("moments"))
    await flush()
    expect(state.style).toBe("moments")
    expect(vi.mocked(openStream).mock.calls[0]?.[0]).toMatchObject({
      kind: "summary",
      style: "moments",
    })
  })

  it("auto-summarizes once when enabled", async () => {
    settings = { ...DEFAULT_SETTINGS, autoSummarize: true }
    enabled = true
    vi.mocked(readTextFromUIStream).mockResolvedValue("Auto")
    await mount()
    await flush()
    expect(openStream).toHaveBeenCalledTimes(1)
    expect(state.status).toBe("done")
  })

  it("tolerates legacy settings without the newer fields", async () => {
    settings = { provider: "openai" } as unknown as Settings
    await mount()
    vi.mocked(readTextFromUIStream).mockResolvedValue("Out")
    await act(async () => state.generate())
    expect(state.style).toBe("detailed")
    expect(vi.mocked(openStream).mock.calls[0]?.[0]).toMatchObject({
      language: "match",
      customInstructions: "",
    })
  })

  it("persists feedback into the stored summary", async () => {
    await summariesItem.setValue({
      vid: { style: "tldr", model: "m", language: "en", text: "Saved", createdAt: 1 },
    })
    await mount()
    await act(async () => state.setFeedback("up"))
    await flush()
    expect(state.feedback).toBe("up")
  })
})
