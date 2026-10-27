import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { MeResponse } from "@/lib/pro/types"
import { LimitGate } from "./LimitGate"

const mocks = vi.hoisted(() => ({
  me: null as MeResponse | null,
  setView: vi.fn(),
}))

vi.mock("@/hooks/usePro", () => ({ usePro: () => ({ me: mocks.me }) }))
vi.mock("@/components/shell/NavigationContext", () => ({
  usePanelNav: () => ({ setView: mocks.setView }),
}))

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

const me = (plan: MeResponse["plan"], summaries: number, chats = 0): MeResponse => ({
  user: { email: "a@b.c", name: "A", image: null },
  plan,
  usage: { summaries, chats, summaryLimit: 300, chatLimit: 1000, resetsAt: null },
  subscription: null,
})

let root: Root
let el: HTMLDivElement
const onCleared = vi.fn()

async function render(resetsAt: string | null = null, kind: "summary" | "chat" = "summary") {
  await act(async () =>
    root.render(<LimitGate kind={kind} resetsAt={resetsAt} onCleared={onCleared} />),
  )
}

describe("LimitGate", () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    mocks.me = me("pro", 300)
    onCleared.mockClear()
    mocks.setView.mockClear()
    el = document.createElement("div")
    root = createRoot(el)
  })

  afterEach(() => act(() => root.unmount()))

  it("shows the reset date, or next month without one", async () => {
    await render("2026-11-01T00:00:00Z")
    expect(el.querySelector("h2")?.textContent).toBe("Monthly limit reached")
    expect(el.textContent).toContain("Resets Nov 1. Switch to your own key to keep going.")
    await render(null)
    expect(el.textContent).toContain("Resets next month. Switch to your own key to keep going.")
  })

  it("routes to the key screen", async () => {
    await render()
    await act(async () => el.querySelector("button")?.click())
    expect(mocks.setView).toHaveBeenCalledWith("onboarding", { screen: "key" })
  })

  it("stays while the account is unchanged", async () => {
    await render()
    mocks.me = me("pro", 300)
    await render()
    expect(onCleared).not.toHaveBeenCalled()
  })

  it("clears when the plan changes", async () => {
    mocks.me = me("trial", 20)
    await render()
    mocks.me = me("pro", 20)
    await render()
    expect(onCleared).toHaveBeenCalledTimes(1)
  })

  it("clears when the usage for its kind resets", async () => {
    await render(null, "chat")
    mocks.me = me("pro", 0, 1000)
    await render(null, "chat")
    expect(onCleared).not.toHaveBeenCalled()
    mocks.me = me("pro", 0, 0)
    await render(null, "chat")
    expect(onCleared).toHaveBeenCalledTimes(1)
  })

  it("only records the first account load", async () => {
    mocks.me = null
    await render()
    mocks.me = me("pro", 300)
    await render()
    expect(onCleared).not.toHaveBeenCalled()
  })
})
