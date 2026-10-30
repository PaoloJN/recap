import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { MeResponse, Pricing } from "@/lib/pro/types"
import { resetUpgradeToastForTests, UpgradeGate } from "./UpgradeGate"

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(async () => {}),
  toast: vi.fn(),
  setView: vi.fn(),
  plan: "trial" as MeResponse["plan"],
  pricing: null as Pricing | null,
}))

vi.mock("@/hooks/usePro", () => ({
  usePro: () => ({
    enabled: true,
    signedIn: true,
    me: {
      user: { email: "a@b.c", name: "A", image: null },
      plan: mocks.plan,
      usage: { summaries: 20, chats: 0, summaryLimit: 20, chatLimit: 50, resetsAt: null },
      subscription: null,
    },
    signOut: vi.fn(),
    refresh: mocks.refresh,
  }),
}))
vi.mock("@/hooks/usePricing", () => ({ usePricing: () => mocks.pricing }))
vi.mock("@/lib/pro/config", () => ({
  PRO_ENABLED: true,
  PRO_ORIGIN: "https://recap.test",
  proUrl: (path: string) => `https://recap.test${path}`,
}))
vi.mock("@/components/shell/ToastContext", () => ({ useToast: () => mocks.toast }))
vi.mock("@/components/shell/NavigationContext", () => ({
  usePanelNav: () => ({ setView: mocks.setView, selectTab: vi.fn() }),
}))

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

let root: Root
let el: HTMLDivElement
let visibility: DocumentVisibilityState = "visible"
const onUpgraded = vi.fn()

async function render(kind: "summary" | "chat" = "summary") {
  await act(async () => root.render(<UpgradeGate kind={kind} onUpgraded={onUpgraded} />))
}

function button(label: string): HTMLButtonElement {
  const found = [...el.querySelectorAll("button")].find((b) => b.textContent === label)
  if (!found) throw new Error(`no button ${label}`)
  return found
}

async function clickUpgrade() {
  await act(async () => button("Get Recap Pro").click())
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

describe("UpgradeGate", () => {
  beforeEach(async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    vi.useFakeTimers()
    mocks.refresh.mockClear()
    mocks.toast.mockClear()
    mocks.setView.mockClear()
    onUpgraded.mockClear()
    mocks.plan = "trial"
    mocks.pricing = null
    resetUpgradeToastForTests()
    visibility = "visible"
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility)
    vi.spyOn(window, "open").mockImplementation(() => null)
    el = document.createElement("div")
    root = createRoot(el)
  })

  afterEach(() => {
    act(() => root.unmount())
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("shows the summary and chat headings and price copy", async () => {
    await render("summary")
    expect(el.querySelector("h2")?.textContent).toBe("Your free summaries are used up")
    expect(el.textContent).toContain(
      "Recap Pro is a small monthly plan for 300 summaries and 1,000 chat messages. Cancel anytime.",
    )
    mocks.pricing = { monthly: { display: "$4.99" }, yearly: { display: "$39.99" } }
    await render("chat")
    expect(el.querySelector("h2")?.textContent).toBe("Your free messages are used up")
    expect(el.textContent).toContain(
      "Recap Pro is $4.99 a month for 300 summaries and 1,000 chat messages. Cancel anytime.",
    )
  })

  it("opens the upgrade page in a new tab and polls every 5 s", async () => {
    await render()
    await advance(10_000)
    expect(mocks.refresh).not.toHaveBeenCalled()
    await clickUpgrade()
    expect(window.open).toHaveBeenCalledWith(
      "https://recap.test/account?upgrade=monthly",
      "_blank",
      "noopener",
    )
    await advance(5_000)
    expect(mocks.refresh).toHaveBeenCalledTimes(1)
    await advance(10_000)
    expect(mocks.refresh).toHaveBeenCalledTimes(3)
  })

  it("stops when the plan turns pro, toasts and clears the gate", async () => {
    await render()
    await clickUpgrade()
    await advance(5_000)
    expect(mocks.refresh).toHaveBeenCalledTimes(1)
    mocks.plan = "pro"
    await render()
    expect(mocks.toast).toHaveBeenCalledWith("You're on Recap Pro")
    expect(onUpgraded).toHaveBeenCalledTimes(1)
    await advance(30_000)
    expect(mocks.refresh).toHaveBeenCalledTimes(1)
    await render()
    expect(onUpgraded).toHaveBeenCalledTimes(1)
  })

  it("stops after 2 minutes", async () => {
    await render()
    await clickUpgrade()
    await advance(120_000)
    const calls = mocks.refresh.mock.calls.length
    expect(calls).toBeGreaterThanOrEqual(23)
    expect(calls).toBeLessThanOrEqual(24)
    await advance(60_000)
    expect(mocks.refresh).toHaveBeenCalledTimes(calls)
  })

  it("pauses while the YouTube tab is hidden", async () => {
    await render()
    await clickUpgrade()
    visibility = "hidden"
    await advance(30_000)
    expect(mocks.refresh).not.toHaveBeenCalled()
    visibility = "visible"
    await advance(5_000)
    expect(mocks.refresh).toHaveBeenCalledTimes(1)
  })

  it("never runs two pollers, across re-renders and repeated clicks", async () => {
    await render()
    await clickUpgrade()
    await render()
    await clickUpgrade()
    await render()
    await advance(5_000)
    expect(mocks.refresh).toHaveBeenCalledTimes(1)
    expect(window.open).toHaveBeenCalledTimes(2)
  })

  it("stops polling on unmount", async () => {
    await render()
    await clickUpgrade()
    act(() => root.unmount())
    root = createRoot(el)
    await advance(30_000)
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  it("offers your own key instead", async () => {
    await render()
    await act(async () => button("Use my own key instead").click())
    expect(mocks.setView).toHaveBeenCalledWith("onboarding", { screen: "key" })
  })

  it("clears when the plan turns pro after the poll window ran out", async () => {
    await render()
    await clickUpgrade()
    visibility = "hidden"
    await advance(180_000)
    expect(mocks.refresh).not.toHaveBeenCalled()
    // Back on YouTube, usePro's own refresh brings the new plan.
    visibility = "visible"
    mocks.plan = "pro"
    await render()
    expect(onUpgraded).toHaveBeenCalledTimes(1)
    expect(mocks.toast).toHaveBeenCalledTimes(1)
    expect(mocks.toast).toHaveBeenCalledWith("You're on Recap Pro")
  })

  it("clears both panes' gates and toasts once", async () => {
    const onChat = vi.fn()
    const both = async () =>
      act(async () =>
        root.render(
          <>
            <UpgradeGate kind="summary" onUpgraded={onUpgraded} />
            <UpgradeGate kind="chat" onUpgraded={onChat} />
          </>,
        ),
      )
    await both()
    await act(async () => [...el.querySelectorAll("button")][0]?.click())
    visibility = "hidden"
    await advance(150_000)
    visibility = "visible"
    mocks.plan = "pro"
    await both()
    expect(onUpgraded).toHaveBeenCalledTimes(1)
    expect(onChat).toHaveBeenCalledTimes(1)
    expect(mocks.toast).toHaveBeenCalledTimes(1)
  })

  it("clears without a toast when no upgrade was started on this page", async () => {
    await render()
    mocks.plan = "pro"
    await render()
    expect(onUpgraded).toHaveBeenCalledTimes(1)
    expect(mocks.toast).not.toHaveBeenCalled()
  })

  it("keeps the gate and refreshes when it mounts with a cached pro plan (stale 402)", async () => {
    mocks.plan = "pro"
    await render()
    expect(el.querySelector("h2")?.textContent).toBe("Your free summaries are used up")
    expect(mocks.refresh).toHaveBeenCalledTimes(1)
    expect(onUpgraded).not.toHaveBeenCalled()
    await render()
    expect(onUpgraded).not.toHaveBeenCalled()
    // The refresh corrects the snapshot; a real upgrade later still clears.
    mocks.plan = "expired"
    await render()
    mocks.plan = "pro"
    await render()
    expect(onUpgraded).toHaveBeenCalledTimes(1)
  })

  it("forgets the toast when the window ends on YouTube without an upgrade", async () => {
    await render()
    await clickUpgrade()
    await advance(180_000)
    mocks.plan = "pro"
    await render()
    expect(onUpgraded).toHaveBeenCalledTimes(1)
    expect(mocks.toast).not.toHaveBeenCalled()
  })
})
