import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { browser } from "wxt/browser"
import { fakeBrowser } from "wxt/testing/fake-browser"
import type { ProAuthResult } from "@/lib/port-protocol"
import type { MeResponse, Pricing, ProState } from "@/lib/pro/types"
import { proItem } from "@/lib/storage"
import { resetPricingCacheForTests, usePro } from "./usePro"

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
const PRICING: Pricing = { monthly: { display: "$4.99" }, yearly: { display: "$39.99" } }

type Pro = ReturnType<typeof usePro>
let pro: Pro
let root: Root | null = null

function Probe() {
  pro = usePro()
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
  api.fetchPricing.mockReset()
  api.fetchPricing.mockResolvedValue(PRICING)
  resetPricingCacheForTests()
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

  it("loads pricing once per page, shared across mounts", async () => {
    await mount()
    expect(pro.pricing).toEqual(PRICING)
    expect(api.fetchPricing).toHaveBeenCalledTimes(1)

    act(() => root?.unmount())
    await mount()
    expect(pro.pricing).toEqual(PRICING)
    expect(api.fetchPricing).toHaveBeenCalledTimes(1)
  })

  it("keeps null on failure and retries on the next mount", async () => {
    api.fetchPricing.mockRejectedValueOnce(new Error("offline"))
    await mount()
    expect(pro.pricing).toBeNull()

    act(() => root?.unmount())
    await mount()
    expect(pro.pricing).toEqual(PRICING)
    expect(api.fetchPricing).toHaveBeenCalledTimes(2)
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

describe("usePro sign-in and sign-out", () => {
  it("returns the background result and toggles signingIn", async () => {
    await mount()
    let release: (r: ProAuthResult) => void = () => {}
    sendMessage.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve
        }),
    )
    let p: Promise<ProAuthResult> | undefined
    await act(async () => {
      p = pro.signIn()
    })
    expect(pro.signingIn).toBe(true)
    await act(async () => {
      await seed({ token: "tok" })
      release({ ok: true })
      await p
    })
    expect(await p).toEqual({ ok: true })
    expect(pro.signingIn).toBe(false)
    expect(sendMessage).toHaveBeenCalledWith({ type: "pro-sign-in" })
  })

  it("passes a cancel through", async () => {
    await mount()
    const cancelled: ProAuthResult = {
      ok: false,
      reason: "cancelled",
      message: "Sign-in cancelled.",
    }
    sendMessage.mockResolvedValueOnce(cancelled)
    let result: ProAuthResult | undefined
    await act(async () => {
      result = await pro.signIn()
    })
    expect(result).toEqual(cancelled)
    expect(pro.signingIn).toBe(false)
  })

  it("maps a rejected message to a failure and resets signingIn", async () => {
    await mount()
    sendMessage.mockRejectedValueOnce(new Error("The message port closed before a response"))
    let result: ProAuthResult | undefined
    await act(async () => {
      result = await pro.signIn()
    })
    expect(result).toEqual({ ok: false, reason: "failed", message: "Couldn't sign in. Try again." })
    expect(pro.signingIn).toBe(false)
  })

  it("treats a rejected message as success when a token was stored meanwhile", async () => {
    await mount()
    sendMessage.mockImplementationOnce(async () => {
      await seed({ token: "tok" })
      throw new Error("The message port closed before a response")
    })
    let result: ProAuthResult | undefined
    await act(async () => {
      result = await pro.signIn()
    })
    expect(result).toEqual({ ok: true })
    expect(pro.signingIn).toBe(false)
  })

  it("does not count a token that was already stored before the call as success", async () => {
    await seed({ token: "old" })
    await mount()
    sendMessage.mockRejectedValueOnce(new Error("The message port closed before a response"))
    let result: ProAuthResult | undefined
    await act(async () => {
      result = await pro.signIn()
    })
    expect(result).toEqual({ ok: false, reason: "failed", message: "Couldn't sign in. Try again." })
  })

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
    expect(pro.pricing).toBeNull()
    await act(async () => {
      await pro.refresh()
      await pro.signIn()
      await pro.signOut()
    })
    expect(sendMessage).not.toHaveBeenCalled()
    expect(api.fetchPricing).not.toHaveBeenCalled()
  })
})
