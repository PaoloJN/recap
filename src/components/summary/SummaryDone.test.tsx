import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ToastProvider } from "@/components/shell/ToastContext"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { ParsedSummary } from "@/lib/summary/parse"
import type { SummaryStyle } from "@/lib/types"
import { seekTo } from "@/lib/youtube/player"
import { SummaryDone } from "./SummaryDone"

vi.mock("@/lib/youtube/player", () => ({ seekTo: vi.fn(), onPlayerState: vi.fn(() => () => {}) }))
vi.mock("@/hooks/usePlayer", () => ({ usePlayer: () => ({ ms: 20_000, paused: false }) }))

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

const parsed: ParsedSummary = {
  lead: "A short lead.",
  moments: [
    { seconds: 14, text: "Intro to streaming" },
    { seconds: 108, text: "Suspense boundaries" },
  ],
  notes: ["One note"],
  plain: "Plain words.",
  questions: [],
}

describe("SummaryDone", () => {
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

  function render(style: SummaryStyle) {
    act(() => {
      root.render(
        <ToastProvider>
          <TooltipProvider>
            <SummaryDone
              parsed={parsed}
              style={style}
              feedback={undefined}
              onFeedback={() => {}}
              onCopy={() => {}}
              onFollowUp={() => {}}
              meta="GPT-6 Luna · Detailed · EN"
            />
          </TooltipProvider>
        </ToastProvider>,
      )
    })
  }

  const momentRows = () =>
    Array.from(container.querySelectorAll("button")).filter((b) =>
      parsed.moments.some((m) => b.textContent?.includes(m.text)),
    )

  it("marks the last moment at or before the playhead as current", () => {
    render("detailed")
    const rows = momentRows()
    expect(rows).toHaveLength(2)
    expect(rows[0]?.getAttribute("aria-current")).toBe("true")
    expect(rows[1]?.hasAttribute("aria-current")).toBe(false)
  })

  it("shows only the lead for tldr", () => {
    render("tldr")
    expect(container.textContent).toContain("A short lead.")
    expect(container.textContent).not.toContain("Key moments")
    expect(container.textContent).not.toContain("Notes")
    expect(container.textContent).not.toContain("In plain terms")
  })

  it("seeks to a moment on click", () => {
    render("detailed")
    act(() => momentRows()[0]?.click())
    expect(seekTo).toHaveBeenCalledWith(14)
  })
})
