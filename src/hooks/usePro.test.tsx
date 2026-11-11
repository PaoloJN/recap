import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { browser } from "wxt/browser"
import { fakeBrowser } from "wxt/testing/fake-browser"
import type { ProLinkPollResult, ProLinkStartResult } from "@/lib/port-protocol"
import type { MeResponse, ProState } from "@/lib/pro/types"
import { proItem } from "@/lib/storage"
import { resetProLinkForTests, usePro } from "./usePro"

const cfg = vi.hoisted(() => ({ enabled: true }))
const api = vi.hoisted(() => ({ fetchPricing: vi.fn() }))

vi.mock("@/lib/pro/config", () => ({
  get PRO_ENABLED() {
    return cfg.enabled
  },
  PRO_ORIGIN: "https://recap.test",
  proUrl: (path: string) => `https://recap.test${path}`,
}))
vi.mock("@/lib/pro/api", () => ({ fetchPricing: api.fetchPricing }))

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

const NOW = Date.parse("2026-10-27T12:00:00Z")
const MIN = 60_000

const ME: MeResponse = {
  user: { email: "a@b.c", name: "A", image: null },
  plan: "trial",
  usage: { summaries: 1, chats: 0, summaryLimit: 20, chatLimit: 50, resetsAt: null },
  subscription: null,
}

type Pro = ReturnType<typeof usePro>
let pro: Pro
let root: Root | null = null

function Probe() {
  pro = usePro()
  return null
}

let other: Pro
function Other() {
  other = usePro()
  return null
}

async function mount() {
  root = createRoot(document.createElement("div"))
  await act(async () => root?.render(<Probe />))
  await flush()
}

async function flush() {
  await act(async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve()
  })
}

let sendMessage: ReturnType<typeof vi.fn>

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state })
  document.dispatchEvent(new Event("visibilitychange"))
}

function refreshCalls() {
  return sendMessage.mock.calls.filter(([m]) => m.type === "pro-refresh").length
}

beforeEach(async () => {
  fakeBrowser.reset()
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOW)
  cfg.enabled = true
  resetProLinkForTests()
  api.fetchPricing.mockReset()
  sendMessage = vi.fn(async (message: { type: string }) => {
    if (message.type === "pro-refresh") {
      const state = await proItem.getValue()
      await proItem.setValue({ ...state, me: ME, fetchedAt: Date.now() })
      return { ok: true, me: ME }
    }
    if (message.type === "pro-sign-out") {
      await proItem.setValue({ token: null, me: null, fetchedAt: 0 })
      return { ok: true }
    }
    return undefined
  })
  vi.spyOn(browser.runtime, "sendMessage").mockImplementation(
    sendMessage as unknown as typeof browser.runtime.sendMessage,
  )
  setVisibility("visible")
})

afterEach(() => {
  act(() => root?.unmount())
  root = null
  vi.useRealTimers()
  vi.restoreAllMocks()
})

async function seed(state: Partial<ProState>) {
  await proItem.setValue({ token: null, me: null, fetchedAt: 0, ...state })
}

describe("usePro state", () => {
  it("reflects the stored token and me", async () => {
    await seed({ token: "tok", me: ME, fetchedAt: NOW })
    await mount()
    expect(pro.enabled).toBe(true)
    expect(pro.signedIn).toBe(true)
    expect(pro.me).toEqual(ME)
  })

  it("updates live when another context writes proItem", async () => {
    await mount()
    expect(pro.signedIn).toBe(false)
    await act(async () => seed({ token: "tok", me: ME, fetchedAt: NOW }))
    await flush()
    expect(pro.signedIn).toBe(true)
    expect(pro.me).toEqual(ME)
  })

  it("never fetches pricing (only the price-showing gates do)", async () => {
    await seed({ token: "tok", me: ME, fetchedAt: NOW })
    await mount()
    expect(api.fetchPricing).not.toHaveBeenCalled()
    expect(pro).not.toHaveProperty("pricing")
  })
})

describe("usePro refresh policy", () => {
  it("refreshes on mount when signed in and stale", async () => {
    await seed({ token: "tok", me: ME, fetchedAt: NOW - 6 * MIN })
    await mount()
    expect(refreshCalls()).toBe(1)
  })

  it("does not refresh on mount when fresh", async () => {
    await seed({ token: "tok", me: ME, fetchedAt: NOW - 4 * MIN })
    await mount()
    expect(refreshCalls()).toBe(0)
  })

  it("does not refresh when signed out", async () => {
    await mount()
    setVisibility("visible")
    await flush()
    expect(refreshCalls()).toBe(0)
  })

  it("refreshes when the tab becomes visible and data went stale", async () => {
    await seed({ token: "tok", me: ME, fetchedAt: NOW - 1 * MIN })
    await mount()
    expect(refreshCalls()).toBe(0)

    vi.setSystemTime(NOW + 3 * MIN)
    setVisibility("visible")
    await flush()
    expect(refreshCalls()).toBe(0)

    vi.setSystemTime(NOW + 10 * MIN)
    setVisibility("hidden")
    await flush()
    expect(refreshCalls()).toBe(0)

    setVisibility("visible")
    await flush()
    expect(refreshCalls()).toBe(1)
  })

  it("refresh() forces and dedupes concurrent calls", async () => {
    await seed({ token: "tok", me: ME, fetchedAt: NOW })
    await mount()
    let release: () => void = () => {}
    sendMessage.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ ok: true, me: ME })
        }),
    )
    let a: Promise<void> | undefined
    let b: Promise<void> | undefined
    await act(async () => {
      a = pro.refresh()
      b = pro.refresh()
    })
    expect(refreshCalls()).toBe(1)
    await act(async () => {
      release()
      await Promise.all([a, b])
    })
    await act(async () => pro.refresh())
    expect(refreshCalls()).toBe(2)
  })

  it("refresh() survives a rejected message", async () => {
    await seed({ token: "tok", me: ME, fetchedAt: NOW })
    await mount()
    sendMessage.mockRejectedValueOnce(new Error("Could not establish connection"))
    await act(async () => expect(pro.refresh()).resolves.toBeUndefined())
  })
})

describe("usePro sign-in link", () => {
  const FAILED: ProLinkStartResult = { ok: false, message: "Couldn't sign in. Try again." }
  const VIDEO = "https://www.youtube.com/watch?v=abc&t=42"

  it("startSignIn sends the return URL and marks the link pending", async () => {
    await mount()
    sendMessage.mockResolvedValueOnce({ ok: true })
    let result: ProLinkStartResult | undefined
    await act(async () => {
      result = await pro.startSignIn(VIDEO)
    })
    expect(result).toEqual({ ok: true })
    expect(sendMessage).toHaveBeenCalledWith({ type: "pro-link-start", returnUrl: VIDEO })
    expect(pro.linkPending).toBe(true)
  })

  it("startSignIn passes a failure through and stays idle", async () => {
    await mount()
    sendMessage.mockResolvedValueOnce({ ok: false, message: "Can't reach Recap Pro." })
    let result: ProLinkStartResult | undefined
    await act(async () => {
      result = await pro.startSignIn(null)
    })
    expect(result).toEqual({ ok: false, message: "Can't reach Recap Pro." })
    expect(sendMessage).toHaveBeenCalledWith({ type: "pro-link-start", returnUrl: null })
    expect(pro.linkPending).toBe(false)
  })

  it("startSignIn maps a rejected or empty reply to a failure", async () => {
    await mount()
    sendMessage.mockRejectedValueOnce(new Error("Could not establish connection"))
    let result: ProLinkStartResult | undefined
    await act(async () => {
      result = await pro.startSignIn(null)
    })
    expect(result).toEqual(FAILED)
    sendMessage.mockResolvedValueOnce(undefined)
    await act(async () => {
      result = await pro.startSignIn(null)
    })
    expect(result).toEqual(FAILED)
    expect(pro.linkPending).toBe(false)
  })

  it.each([
    ["pending", true],
    ["signed-in", true],
    ["error", true],
    ["done", false],
    ["expired", false],
    ["idle", false],
  ] as const)("a %s poll leaves linkPending %s", async (state, pending) => {
    await mount()
    sendMessage.mockResolvedValueOnce({ ok: true })
    await act(async () => {
      await pro.startSignIn(null)
    })
    sendMessage.mockResolvedValueOnce({ state })
    let result: ProLinkPollResult | null | undefined
    await act(async () => {
      result = await pro.pollLink()
    })
    expect(result).toEqual({ state })
    expect(sendMessage).toHaveBeenCalledWith({ type: "pro-link-poll" })
    expect(pro.linkPending).toBe(pending)
  })

  it("a rejected poll is an error and keeps the link pending", async () => {
    await mount()
    sendMessage.mockResolvedValueOnce({ ok: true })
    await act(async () => {
      await pro.startSignIn(null)
    })
    sendMessage.mockRejectedValueOnce(new Error("Could not establish connection"))
    let result: ProLinkPollResult | null | undefined
    await act(async () => {
      result = await pro.pollLink()
    })
    expect(result).toEqual({ state: "error" })
    expect(pro.linkPending).toBe(true)
  })

  it("ignores a poll answered after a cancel", async () => {
    await mount()
    sendMessage.mockResolvedValueOnce({ ok: true })
    await act(async () => {
      await pro.startSignIn(null)
    })
    let answer: (r: ProLinkPollResult) => void = () => {}
    sendMessage.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          answer = resolve
        }),
    )
    let polled: Promise<ProLinkPollResult | null> = Promise.resolve(null)
    act(() => {
      polled = pro.pollLink()
    })
    sendMessage.mockResolvedValueOnce({ ok: true })
    await act(async () => pro.cancelSignIn())
    let result: ProLinkPollResult | null = { state: "idle" }
    await act(async () => {
      answer({ state: "pending" })
      result = await polled
    })
    expect(result).toBeNull()
    expect(pro.linkPending).toBe(false)
  })

  it.each([
    ["pending", true],
    ["signed-in", true],
    ["error", false],
    ["idle", false],
  ] as const)("a %s probe leaves linkPending %s", async (state, pending) => {
    await mount()
    sendMessage.mockResolvedValueOnce({ state })
    let result: ProLinkPollResult | null = null
    await act(async () => {
      result = await pro.probeLink()
    })
    expect(result).toEqual({ state })
    expect(sendMessage).toHaveBeenCalledWith({ type: "pro-link-poll" })
    expect(pro.linkPending).toBe(pending)
  })

  it("linkStartedHere is set by this page's start and cleared by a probe or cancel", async () => {
    await mount()
    expect(pro.linkStartedHere).toBe(false)
    sendMessage.mockResolvedValueOnce({ ok: true })
    await act(async () => {
      await pro.startSignIn(null)
    })
    expect(pro.linkStartedHere).toBe(true)
    sendMessage.mockResolvedValueOnce({ ok: true })
    await act(async () => pro.cancelSignIn())
    expect(pro.linkStartedHere).toBe(false)
    sendMessage.mockResolvedValueOnce({ ok: true })
    await act(async () => {
      await pro.startSignIn(null)
    })
    expect(pro.linkStartedHere).toBe(true)
    // A probe that finds a flow (here, after a reload's module reset) can't tell whose it is.
    sendMessage.mockResolvedValueOnce({ state: "pending" })
    await act(async () => {
      await pro.probeLink()
    })
    expect(pro.linkPending).toBe(true)
    expect(pro.linkStartedHere).toBe(false)
  })

  it("shares linkPending across every component using the hook", async () => {
    root = createRoot(document.createElement("div"))
    await act(async () =>
      root?.render(
        <>
          <Probe />
          <Other />
        </>,
      ),
    )
    sendMessage.mockResolvedValueOnce({ ok: true })
    await act(async () => {
      await pro.startSignIn(null)
    })
    expect(other.linkPending).toBe(true)
  })

  it("reopenSignIn asks the background", async () => {
    await mount()
    sendMessage.mockResolvedValueOnce({ ok: true })
    await act(async () => pro.reopenSignIn())
    expect(sendMessage).toHaveBeenCalledWith({ type: "pro-link-reopen" })
  })

  it("reopenSignIn survives a rejected message", async () => {
    await mount()
    sendMessage.mockRejectedValueOnce(new Error("Could not establish connection"))
    await act(async () => expect(pro.reopenSignIn()).resolves.toBeUndefined())
  })

  it("cancelSignIn asks the background and clears linkPending, even if unreachable", async () => {
    await mount()
    sendMessage.mockResolvedValueOnce({ ok: true })
    await act(async () => {
      await pro.startSignIn(null)
    })
    sendMessage.mockRejectedValueOnce(new Error("Could not establish connection"))
    await act(async () => expect(pro.cancelSignIn()).resolves.toBeUndefined())
    expect(sendMessage).toHaveBeenCalledWith({ type: "pro-link-cancel" })
    expect(pro.linkPending).toBe(false)
  })
})

describe("usePro sign-out", () => {
  it("signOut asks the background and clears state", async () => {
    await seed({ token: "tok", me: ME, fetchedAt: NOW })
    await mount()
    await act(async () => pro.signOut())
    await flush()
    expect(sendMessage).toHaveBeenCalledWith({ type: "pro-sign-out" })
    expect(pro.signedIn).toBe(false)
  })

  it("signOut clears local state when the background is unreachable", async () => {
    await seed({ token: "tok", me: ME, fetchedAt: NOW })
    await mount()
    sendMessage.mockRejectedValueOnce(new Error("Could not establish connection"))
    await act(async () => pro.signOut())
    await flush()
    expect((await proItem.getValue()).token).toBeNull()
    expect(pro.signedIn).toBe(false)
  })
})

describe("usePro signOut fallback", () => {
  it("never rejects when the local fallback write fails", async () => {
    await seed({ token: "tok", me: ME, fetchedAt: NOW })
    await mount()
    sendMessage.mockRejectedValueOnce(new Error("Could not establish connection"))
    const spy = vi.spyOn(proItem, "setValue").mockRejectedValueOnce(new Error("quota"))
    await act(async () => {
      await expect(pro.signOut()).resolves.toBeUndefined()
    })
    spy.mockRestore()
  })
})

describe("usePro when Pro is disabled", () => {
  it("is inert", async () => {
    cfg.enabled = false
    await seed({ token: "tok", me: ME, fetchedAt: 0 })
    await mount()
    setVisibility("visible")
    await flush()
    expect(pro.enabled).toBe(false)
    expect(pro.signedIn).toBe(false)
    expect(pro.me).toBeNull()
    expect(pro.linkPending).toBe(false)
    await act(async () => {
      await pro.refresh()
      await pro.startSignIn(null)
      await pro.pollLink()
      await pro.reopenSignIn()
      await pro.cancelSignIn()
      await pro.signOut()
    })
    expect(sendMessage).not.toHaveBeenCalled()
    expect(api.fetchPricing).not.toHaveBeenCalled()
  })
})
