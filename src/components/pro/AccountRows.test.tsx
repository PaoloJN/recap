import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { MeResponse } from "@/lib/pro/types"
import { AccountRows, resetReturnRefreshForTests } from "./AccountRows"

const mocks = vi.hoisted(() => ({
  signedIn: true,
  me: null as MeResponse | null,
  signOut: vi.fn(async () => {}),
  signIn: vi.fn(async () => {}),
  toast: vi.fn(),
  refresh: vi.fn(async () => {}),
}))

vi.mock("@/hooks/usePro", () => ({
  usePro: () => ({
    enabled: true,
    signedIn: mocks.signedIn,
    me: mocks.me,
    signOut: mocks.signOut,
    refresh: mocks.refresh,
  }),
}))
vi.mock("./useProSignIn", () => ({
  useProSignIn: () => ({ signIn: mocks.signIn, signingIn: false }),
}))
vi.mock("@/lib/pro/config", () => ({
  PRO_ENABLED: true,
  PRO_ORIGIN: "https://recap.test",
  proUrl: (path: string) => `https://recap.test${path}`,
}))
vi.mock("@/components/shell/ToastContext", () => ({ useToast: () => mocks.toast }))

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

function me(plan: MeResponse["plan"], image: string | null = null): MeResponse {
  return {
    user: { email: "ada@example.com", name: "Ada", image },
    plan,
    usage: { summaries: 8, chats: 10, summaryLimit: 20, chatLimit: 50, resetsAt: null },
    subscription: null,
  }
}

let root: Root
let el: HTMLDivElement
let visibility: DocumentVisibilityState = "visible"

async function setVisible(next: DocumentVisibilityState) {
  visibility = next
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"))
  })
}

async function render() {
  await act(async () => root.render(<AccountRows />))
}

function button(label: string): HTMLButtonElement | undefined {
  return [...el.querySelectorAll("button")].find((b) => b.textContent === label)
}

describe("AccountRows", () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    mocks.signedIn = true
    mocks.me = me("trial")
    mocks.signOut.mockClear()
    mocks.signIn.mockClear()
    mocks.toast.mockClear()
    mocks.refresh.mockClear()
    resetReturnRefreshForTests()
    visibility = "visible"
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility)
    vi.spyOn(window, "open").mockImplementation(() => null)
    el = document.createElement("div")
    root = createRoot(el)
  })

  afterEach(() => {
    act(() => root.unmount())
    vi.restoreAllMocks()
  })

  it("offers Google sign-in and no plan row when signed out", async () => {
    mocks.signedIn = false
    mocks.me = null
    await render()
    const signIn = button("Sign in with Google")
    expect(signIn).toBeDefined()
    expect(el.textContent).not.toContain("Trial")
    expect(button("Sign out")).toBeUndefined()
    await act(async () => signIn?.click())
    expect(mocks.signIn).toHaveBeenCalledTimes(1)
  })

  it("shows the account, trial plan and an Upgrade button", async () => {
    await render()
    expect(el.textContent).toContain("ada@example.com")
    expect(el.textContent).toContain("Signed in")
    expect(el.textContent).toContain("Trial · 12 of 20 summaries, 40 of 50 messages left")
    await act(async () => button("Upgrade")?.click())
    expect(window.open).toHaveBeenCalledWith(
      "https://recap.test/account?upgrade=monthly",
      "_blank",
      "noopener",
    )
    expect(button("Manage billing")).toBeUndefined()
  })

  it("shows Upgrade when the trial has ended", async () => {
    mocks.me = me("expired")
    await render()
    expect(el.textContent).toContain("Trial ended")
    expect(button("Upgrade")).toBeDefined()
  })

  it("shows Manage billing for Pro", async () => {
    mocks.me = me("pro")
    await render()
    expect(button("Upgrade")).toBeUndefined()
    await act(async () => button("Manage billing")?.click())
    expect(window.open).toHaveBeenCalledWith("https://recap.test/account", "_blank", "noopener")
  })

  it("signs out through the hook", async () => {
    await render()
    await act(async () => button("Sign out")?.click())
    expect(mocks.signOut).toHaveBeenCalledTimes(1)
  })

  it("shows the avatar image and falls back to the initial when it fails", async () => {
    mocks.me = me("trial", "https://img.test/a.png")
    await render()
    const img = el.querySelector("img")
    expect(img?.getAttribute("src")).toBe("https://img.test/a.png")
    expect(img?.getAttribute("referrerpolicy")).toBe("no-referrer")
    await act(async () => img?.dispatchEvent(new Event("error")))
    expect(el.querySelector("img")).toBeNull()
    expect(el.querySelector("[data-avatar]")?.textContent).toBe("A")
  })

  it("refetches the account once when the tab comes back after Upgrade", async () => {
    await render()
    await setVisible("hidden")
    await setVisible("visible")
    expect(mocks.refresh).not.toHaveBeenCalled()

    await act(async () => button("Upgrade")?.click())
    await setVisible("hidden")
    expect(mocks.refresh).not.toHaveBeenCalled()
    await setVisible("visible")
    expect(mocks.refresh).toHaveBeenCalledTimes(1)
    // The listener removed itself.
    await setVisible("hidden")
    await setVisible("visible")
    expect(mocks.refresh).toHaveBeenCalledTimes(1)
  })

  it("keeps one return listener across repeated clicks, even after leaving Settings", async () => {
    await render()
    await act(async () => button("Upgrade")?.click())
    await act(async () => button("Upgrade")?.click())
    act(() => root.unmount())
    root = createRoot(el)
    await setVisible("hidden")
    await setVisible("visible")
    expect(mocks.refresh).toHaveBeenCalledTimes(1)
  })
})
