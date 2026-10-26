import { act } from "react"
import { createRoot } from "react-dom/client"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NoKeyGate } from "./NoKeyGate"

vi.mock("@/components/shell/NavigationContext", () => ({
  usePanelNav: () => ({ setView: vi.fn(), selectTab: vi.fn() }),
}))

describe("NoKeyGate", () => {
  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  })
  it.each(["summarize videos", "chat with videos"] as const)("headline for %s", async (verb) => {
    const el = document.createElement("div")
    await act(async () => createRoot(el).render(<NoKeyGate verb={verb} />))
    expect(el.querySelector("h2")?.textContent).toBe(`Add a key to ${verb}`)
  })
})
