import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import {
  DiagramBridgeError,
  parseDiagram,
  renderDiagram,
  resetDiagramFrame,
} from "@/lib/diagram/bridge"
import { DEFAULT_SETTINGS, type Settings } from "@/lib/storage"
import { openStream, readTextFromUIStream } from "@/lib/transport"
import type { VideoContext } from "@/lib/types"
import { type DiagramState, useDiagram } from "./useDiagram"

vi.mock("@/lib/transport", () => ({
  openStream: vi.fn(() => new ReadableStream()),
  readTextFromUIStream: vi.fn(),
}))

vi.mock("@/lib/diagram/bridge", () => {
  class DiagramBridgeError extends Error {
    constructor(message: string) {
      super(message)
      this.name = "DiagramBridgeError"
    }
  }
  return {
    DiagramBridgeError,
    parseDiagram: vi.fn(),
    renderDiagram: vi.fn(),
    resetDiagramFrame: vi.fn(),
  }
})

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

const ctx: VideoContext = {
  metadata: {
    videoId: "vid",
    title: "The Rise Of AI Coworkers",
    author: "Y Combinator",
    durationSeconds: 60,
  },
  transcript: [{ text: "hi", startMs: 0, endMs: 1000 }],
  language: "en",
}
const selection = { provider: "openai", model: "gpt-6-luna" } as const
const reply = "```mermaid\nflowchart TD\n  A --> B\n```"

let state: DiagramState
let settings: Settings = DEFAULT_SETTINGS

function Probe() {
  state = useDiagram(ctx, selection, settings, false)
  return null
}

describe("useDiagram renderer failure", () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    fakeBrowser.reset()
    settings = DEFAULT_SETTINGS
    vi.mocked(openStream).mockClear()
    vi.mocked(parseDiagram).mockReset()
    vi.mocked(renderDiagram).mockReset()
    vi.mocked(resetDiagramFrame).mockReset()
    vi.mocked(renderDiagram).mockResolvedValue("<svg></svg>")
    container = document.createElement("div")
    root = createRoot(container)
    await act(async () => root.render(<Probe />))
  })

  afterEach(() => {
    act(() => root.unmount())
  })

  it("keeps the model reply when the renderer never loads, and Try again reloads it without another request", async () => {
    vi.mocked(readTextFromUIStream).mockResolvedValue(reply)
    vi.mocked(parseDiagram).mockRejectedValue(
      new DiagramBridgeError("The diagram renderer took too long to load."),
    )
    await act(async () => state.generate({ force: true }))
    expect(state.status).toBe("error")
    expect(state.error).toContain("took too long to load")
    expect(state.raw).toContain("flowchart TD")
    expect(openStream).toHaveBeenCalledTimes(1)

    await act(async () => state.retry())
    expect(resetDiagramFrame).toHaveBeenCalledOnce()
    expect(openStream).toHaveBeenCalledTimes(1)
    expect(renderDiagram).toHaveBeenCalledWith("flowchart TD\n  A --> B", false)
    expect(state.status).toBe("done")
  })
})
