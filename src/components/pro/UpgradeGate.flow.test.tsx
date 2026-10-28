import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { browser } from "wxt/browser"
import { fakeBrowser } from "wxt/testing/fake-browser"
import type { MeResponse } from "@/lib/pro/types"
import { proItem } from "@/lib/storage"
import { resetUpgradeToastForTests, UpgradeGate } from "./UpgradeGate"

// Real usePro (storage snapshot, 5-minute staleness); only the server and the shell are faked.
const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  serverPlan: "trial" as "trial" | "pro" | "expired",
}))

vi.mock("@/lib/pro/config", () => ({
  PRO_ENABLED: true,
  PRO_ORIGIN: "https://recap.test",
  proUrl: (path: string) => `https://recap.test${path}`,
}))
vi.mock("@/lib/pro/api", () => ({ fetchPricing: vi.fn(() => new Promise(() => {})) }))
vi.mock("@/components/shell/ToastContext", () => ({ useToast: () => mocks.toast }))
vi.mock("@/components/shell/NavigationContext", () => ({
  usePanelNav: () => ({ setView: vi.fn(), selectTab: vi.fn() }),
}))

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

const me = (plan: MeResponse["plan"]): MeResponse => ({
  user: { email: "a@b.c", name: "A", image: null },
  plan,
  usage: { summaries: 20, chats: 0, summaryLimit: 20, chatLimit: 50, resetsAt: null },
  subscription: null,
})

let root: Root
let el: HTMLDivElement
let visibility: DocumentVisibilityState = "visible"
const onUpgraded = vi.fn()

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

async function setVisible(next: DocumentVisibilityState) {
  visibility = next
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"))
    await vi.advanceTimersByTimeAsync(0)
  })
}

describe("UpgradeGate with the real account snapshot", () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    vi.useFakeTimers()
    vi.setSystemTime(Date.parse("2026-10-27T12:00:00Z"))
    fakeBrowser.reset()
    resetUpgradeToastForTests()
    mocks.toast.mockClear()
    onUpgraded.mockClear()
    mocks.serverPlan = "trial"
    visibility = "visible"
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility)
    vi.spyOn(window, "open").mockImplementation(() => null)
    vi.spyOn(browser.runtime, "sendMessage").mockImplementation((async (m: { type: string }) => {
      if (m.type !== "pro-refresh") return undefined
      const state = await proItem.getValue()
      await proItem.setValue({ ...state, me: me(mocks.serverPlan), fetchedAt: Date.now() })
      return { ok: true }
    }) as unknown as typeof browser.runtime.sendMessage)
    el = document.createElement("div")
    root = createRoot(el)
  })

  afterEach(() => {
    act(() => root.unmount())
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const refreshCalls = () =>
    vi
      .mocked(browser.runtime.sendMessage)
      .mock.calls.filter(([m]) => (m as unknown as { type: string }).type === "pro-refresh").length

  it("clears with the toast after a 4-minute checkout in another tab", async () => {
    // The 402 just triggered a refresh: the snapshot is fresh and says trial.
    await proItem.setValue({ token: "tok", me: me("trial"), fetchedAt: Date.now() })
    await act(async () => root.render(<UpgradeGate kind="summary" onUpgraded={onUpgraded} />))
    await advance(0)
    expect(el.querySelector("h2")?.textContent).toBe("Your free summaries are used up")

    const button = [...el.querySelectorAll("button")].find((b) => b.textContent === "Get Recap Pro")
    await act(async () => button?.click())
    await setVisible("hidden")
    await advance(4 * 60_000)
    mocks.serverPlan = "pro"
    const before = refreshCalls()

    await setVisible("visible")
    expect(refreshCalls()).toBeGreaterThan(before)
    expect(onUpgraded).toHaveBeenCalledTimes(1)
    expect(mocks.toast).toHaveBeenCalledWith("You're on Recap Pro")
  })

  it("resumes polling on return when hidden time didn't count against the window", async () => {
    await proItem.setValue({ token: "tok", me: me("trial"), fetchedAt: Date.now() })
    await act(async () => root.render(<UpgradeGate kind="chat" onUpgraded={onUpgraded} />))
    await advance(0)
    const button = [...el.querySelectorAll("button")].find((b) => b.textContent === "Get Recap Pro")
    await act(async () => button?.click())
    await setVisible("hidden")
    await advance(4 * 60_000)
    await setVisible("visible")
    const afterReturn = refreshCalls()
    await advance(5_000)
    expect(refreshCalls()).toBe(afterReturn + 1)
    expect(onUpgraded).not.toHaveBeenCalled()
  })
})
