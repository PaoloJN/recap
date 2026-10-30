import { describe, expect, it, vi } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import { ProError } from "@/lib/pro/api"
import type { LinkClaim, MeResponse, ProLink, ProState } from "@/lib/pro/types"
import {
  cancelSignIn,
  type ProAuthDeps,
  pollLink,
  refresh,
  registerProHandlers,
  reopenSignIn,
  signOut,
  startSignIn,
} from "./pro-auth"

vi.mock("@/lib/pro/config", () => ({
  PRO_ORIGIN: "https://recap.test",
  PRO_ENABLED: true,
  proUrl: (path: string) => `https://recap.test${path}`,
}))

const NOW = Date.parse("2026-10-30T12:00:00Z")
const LATER = "2026-10-30T12:30:00.000Z"
const VIDEO = "https://www.youtube.com/watch?v=abc&t=42"

const ME: MeResponse = {
  user: { email: "a@b.c", name: "A", image: null },
  plan: "trial",
  usage: { summaries: 1, chats: 0, summaryLimit: 10, chatLimit: 20, resetsAt: null },
  subscription: null,
}

const EMPTY: ProState = { token: null, me: null, fetchedAt: 0 }

const LINK: ProLink = {
  code: "c0de",
  verifier: "ver",
  signInUrl: "https://recap.test/sign-in?link=c0de",
  signInTabId: 7,
  sourceTabId: 3,
  expiresAt: LATER,
  claimed: false,
}

function memory<T>(initial: T) {
  let value = initial
  return {
    getValue: vi.fn(async () => value),
    setValue: vi.fn(async (v: T) => {
      value = v
    }),
    get: () => value,
  }
}

function setup(
  overrides: Partial<ProAuthDeps> = {},
  initial: ProState = EMPTY,
  link: ProLink | null = null,
) {
  const store = memory(initial)
  const linkStore = memory<ProLink | null>(link)
  const deps: ProAuthDeps = {
    store,
    link: linkStore,
    fetchMe: vi.fn(async () => ME),
    disconnect: vi.fn(async () => {}),
    startLink: vi.fn(async () => ({ code: "c0de", expiresAt: LATER })),
    claimLink: vi.fn(async (): Promise<LinkClaim> => ({ status: "pending" })),
    createPkce: vi.fn(async () => ({ verifier: "ver", challenge: "chal" })),
    tabs: {
      create: vi.fn(async () => ({ id: 7 })),
      update: vi.fn(async () => ({ windowId: 9 })),
      remove: vi.fn(async () => {}),
    },
    windows: { update: vi.fn(async () => ({})) },
    browser: "chrome",
    now: () => NOW,
    ...overrides,
  }
  return { deps, state: () => store.get(), link: () => linkStore.get() }
}

describe("startSignIn", () => {
  it("starts a link, opens the sign-in tab with the return URL and stores the flow", async () => {
    const { deps, link } = setup({ browser: "firefox" })
    expect(await startSignIn(deps, VIDEO, 3)).toEqual({ ok: true })
    expect(deps.startLink).toHaveBeenCalledWith("chal", "firefox")
    const url = `https://recap.test/sign-in?link=c0de&return=${encodeURIComponent(VIDEO)}`
    expect(deps.tabs.create).toHaveBeenCalledWith({ url, active: true })
    expect(link()).toEqual({
      code: "c0de",
      verifier: "ver",
      signInUrl: url,
      signInTabId: 7,
      sourceTabId: 3,
      expiresAt: LATER,
      claimed: false,
    })
  })

  it("omits return when there is none", async () => {
    const { deps, link } = setup()
    await startSignIn(deps, null, null)
    expect(deps.tabs.create).toHaveBeenCalledWith({
      url: "https://recap.test/sign-in?link=c0de",
      active: true,
    })
    expect(link()?.sourceTabId).toBeNull()
  })

  it("replaces a previous flow", async () => {
    const { deps, link } = setup(
      {
        startLink: vi.fn(async () => ({ code: "new", expiresAt: LATER })),
        createPkce: vi.fn(async () => ({ verifier: "ver2", challenge: "chal2" })),
        tabs: {
          create: vi.fn(async () => ({ id: 8 })),
          update: vi.fn(async () => ({ windowId: 9 })),
          remove: vi.fn(async () => {}),
        },
      },
      EMPTY,
      { ...LINK, claimed: true },
    )
    await startSignIn(deps, null, 4)
    expect(link()).toMatchObject({
      code: "new",
      verifier: "ver2",
      signInTabId: 8,
      sourceTabId: 4,
      claimed: false,
    })
  })

  it("fails without storing when the server can't be reached", async () => {
    const { deps, link } = setup({
      startLink: vi.fn(async () => {
        throw new ProError("network", "Can't reach Recap Pro. Check your connection.")
      }),
    })
    expect(await startSignIn(deps, null, 3)).toEqual({
      ok: false,
      message: "Can't reach Recap Pro. Check your connection.",
    })
    expect(deps.tabs.create).not.toHaveBeenCalled()
    expect(link()).toBeNull()
  })

  it("fails without storing when the tab can't be opened", async () => {
    const { deps, link } = setup({
      tabs: {
        create: vi.fn(async () => {
          throw new Error("no")
        }),
        update: vi.fn(),
        remove: vi.fn(),
      },
    })
    expect(await startSignIn(deps, null, 3)).toEqual({
      ok: false,
      message: "Couldn't sign in. Try again.",
    })
    expect(link()).toBeNull()
  })
})

describe("pollLink", () => {
  it("is idle without a flow and does not call the server", async () => {
    const { deps } = setup()
    expect(await pollLink(deps)).toEqual({ state: "idle" })
    expect(deps.claimLink).not.toHaveBeenCalled()
  })

  it("pending keeps the flow", async () => {
    const { deps, link } = setup({}, EMPTY, LINK)
    expect(await pollLink(deps)).toEqual({ state: "pending" })
    expect(deps.claimLink).toHaveBeenCalledWith("c0de", "ver")
    expect(link()).toEqual(LINK)
  })

  it("approved saves the key, refreshes me and marks the flow claimed", async () => {
    const { deps, state, link } = setup(
      {
        claimLink: vi.fn(
          async () => ({ status: "approved", key: "k+1", finished: false }) as const,
        ),
      },
      EMPTY,
      LINK,
    )
    expect(await pollLink(deps)).toEqual({ state: "signed-in" })
    expect(deps.fetchMe).toHaveBeenCalledWith("k+1")
    expect(state()).toEqual({ token: "k+1", me: ME, fetchedAt: NOW })
    expect(link()).toEqual({ ...LINK, claimed: true })
    expect(deps.tabs.remove).not.toHaveBeenCalled()
  })

  it("approved and finished closes the sign-in tab, focuses the source and clears", async () => {
    const { deps, state, link } = setup(
      { claimLink: vi.fn(async () => ({ status: "approved", key: "k", finished: true }) as const) },
      EMPTY,
      LINK,
    )
    expect(await pollLink(deps)).toEqual({ state: "done" })
    expect(state().token).toBe("k")
    expect(deps.tabs.remove).toHaveBeenCalledWith(7)
    expect(deps.tabs.update).toHaveBeenCalledWith(3, { active: true })
    expect(deps.windows.update).toHaveBeenCalledWith(9, { focused: true })
    expect(link()).toBeNull()
  })

  it("claimed and finished after an earlier approval finishes", async () => {
    const { deps, link } = setup(
      { claimLink: vi.fn(async () => ({ status: "claimed", finished: true }) as const) },
      { token: "k", me: ME, fetchedAt: NOW },
      { ...LINK, claimed: true },
    )
    expect(await pollLink(deps)).toEqual({ state: "done" })
    expect(deps.tabs.remove).toHaveBeenCalledWith(7)
    expect(link()).toBeNull()
  })

  it("claimed but not finished stays signed-in", async () => {
    const { deps, link } = setup(
      { claimLink: vi.fn(async () => ({ status: "claimed", finished: false }) as const) },
      { token: "k", me: ME, fetchedAt: NOW },
      { ...LINK, claimed: true },
    )
    expect(await pollLink(deps)).toEqual({ state: "signed-in" })
    expect(link()).toEqual({ ...LINK, claimed: true })
  })

  it("claimed by nobody we know of (key lost) is an error and clears", async () => {
    const { deps, link } = setup(
      { claimLink: vi.fn(async () => ({ status: "claimed", finished: true }) as const) },
      EMPTY,
      LINK,
    )
    expect(await pollLink(deps)).toEqual({ state: "error" })
    expect(deps.tabs.remove).not.toHaveBeenCalled()
    expect(link()).toBeNull()
  })

  it("a source tab that can't be focused still clears the flow and returns done", async () => {
    const { deps, link } = setup(
      {
        claimLink: vi.fn(async () => ({ status: "approved", key: "k", finished: true }) as const),
        tabs: {
          create: vi.fn(),
          update: vi.fn(async () => {
            throw new Error("No tab with id: 3")
          }),
          remove: vi.fn(async () => {
            throw new Error("No tab with id: 7")
          }),
        },
      },
      EMPTY,
      LINK,
    )
    expect(await pollLink(deps)).toEqual({ state: "done" })
    expect(deps.windows.update).not.toHaveBeenCalled()
    expect(link()).toBeNull()
  })

  it("a window that can't be focused still returns done", async () => {
    const { deps, link } = setup(
      {
        claimLink: vi.fn(async () => ({ status: "approved", key: "k", finished: true }) as const),
        windows: {
          update: vi.fn(async () => {
            throw new Error("No window")
          }),
        },
      },
      EMPTY,
      LINK,
    )
    expect(await pollLink(deps)).toEqual({ state: "done" })
    expect(link()).toBeNull()
  })

  it("skips tabs it doesn't know", async () => {
    const { deps } = setup(
      { claimLink: vi.fn(async () => ({ status: "approved", key: "k", finished: true }) as const) },
      EMPTY,
      { ...LINK, signInTabId: null, sourceTabId: null },
    )
    expect(await pollLink(deps)).toEqual({ state: "done" })
    expect(deps.tabs.remove).not.toHaveBeenCalled()
    expect(deps.tabs.update).not.toHaveBeenCalled()
  })

  it("server-side expiry clears the flow", async () => {
    const { deps, link } = setup(
      { claimLink: vi.fn(async () => ({ status: "expired" }) as const) },
      EMPTY,
      LINK,
    )
    expect(await pollLink(deps)).toEqual({ state: "expired" })
    expect(link()).toBeNull()
  })

  it("a flow past expiresAt clears without calling the server", async () => {
    const { deps, link } = setup({}, EMPTY, { ...LINK, expiresAt: "2026-10-30T11:59:59.000Z" })
    expect(await pollLink(deps)).toEqual({ state: "expired" })
    expect(deps.claimLink).not.toHaveBeenCalled()
    expect(link()).toBeNull()
  })

  it("a network error keeps the flow", async () => {
    const { deps, link } = setup(
      {
        claimLink: vi.fn(async () => {
          throw new ProError("network", "offline")
        }),
      },
      EMPTY,
      LINK,
    )
    expect(await pollLink(deps)).toEqual({ state: "error" })
    expect(link()).toEqual(LINK)
  })

  it("a rejected code or verifier (400) clears the flow", async () => {
    const { deps, link } = setup(
      {
        claimLink: vi.fn(async () => {
          throw new ProError("bad_request", "bad")
        }),
      },
      EMPTY,
      LINK,
    )
    expect(await pollLink(deps)).toEqual({ state: "error" })
    expect(link()).toBeNull()
  })

  it("a key the server rejects straight away (401) is an error and clears", async () => {
    const { deps, state, link } = setup(
      {
        claimLink: vi.fn(async () => ({ status: "approved", key: "k", finished: false }) as const),
        fetchMe: vi.fn(async () => {
          throw new ProError("unauthorized", "nope")
        }),
      },
      EMPTY,
      LINK,
    )
    expect(await pollLink(deps)).toEqual({ state: "error" })
    expect(state().token).toBeNull()
    expect(link()).toBeNull()
  })

  it("a non-401 refresh failure still counts as signed in", async () => {
    const { deps, state } = setup(
      {
        claimLink: vi.fn(async () => ({ status: "approved", key: "k", finished: false }) as const),
        fetchMe: vi.fn(async () => {
          throw new ProError("network", "offline")
        }),
      },
      EMPTY,
      LINK,
    )
    expect(await pollLink(deps)).toEqual({ state: "signed-in" })
    expect(state()).toEqual({ token: "k", me: null, fetchedAt: 0 })
  })

  it("a fresh worker reading the same storage picks up the flow", async () => {
    const first = setup({}, EMPTY, null)
    await startSignIn(first.deps, null, 3)
    // The MV3 worker restarts: new deps, same storage areas.
    const second = setup(
      { claimLink: vi.fn(async () => ({ status: "approved", key: "k", finished: true }) as const) },
      EMPTY,
      first.link(),
    )
    expect(await pollLink(second.deps)).toEqual({ state: "done" })
    expect(second.deps.claimLink).toHaveBeenCalledWith("c0de", "ver")
    expect(second.state().token).toBe("k")
    expect(second.deps.tabs.remove).toHaveBeenCalledWith(7)
    expect(second.deps.tabs.update).toHaveBeenCalledWith(3, { active: true })
  })

  it("concurrent polls share one claim", async () => {
    let answer: (c: LinkClaim) => void = () => {}
    const { deps } = setup(
      {
        claimLink: vi.fn(
          () =>
            new Promise<LinkClaim>((resolve) => {
              answer = resolve
            }),
        ),
      },
      EMPTY,
      LINK,
    )
    const a = pollLink(deps)
    const b = pollLink(deps)
    await vi.waitFor(() => expect(deps.claimLink).toHaveBeenCalledTimes(1))
    answer({ status: "approved", key: "k", finished: false })
    expect(await a).toEqual({ state: "signed-in" })
    expect(await b).toEqual({ state: "signed-in" })
    expect(deps.claimLink).toHaveBeenCalledTimes(1)
  })

  it("a flow replaced mid-claim is left alone", async () => {
    const replacement: ProLink = { ...LINK, code: "other", verifier: "v2" }
    const linkStore = memory<ProLink | null>(LINK)
    const { deps } = setup(
      {
        link: linkStore,
        claimLink: vi.fn(async () => {
          await linkStore.setValue(replacement)
          return { status: "approved", key: "k", finished: true } as const
        }),
      },
      EMPTY,
      null,
    )
    await pollLink(deps)
    expect(linkStore.get()).toEqual(replacement)
  })
})

describe("reopenSignIn", () => {
  it("focuses the open sign-in tab and its window", async () => {
    const { deps, link } = setup({}, EMPTY, LINK)
    expect(await reopenSignIn(deps)).toEqual({ ok: true })
    expect(deps.tabs.update).toHaveBeenCalledWith(7, { active: true })
    expect(deps.windows.update).toHaveBeenCalledWith(9, { focused: true })
    expect(deps.tabs.create).not.toHaveBeenCalled()
    expect(link()).toEqual(LINK)
  })

  it("reopens the same URL when the tab is gone and stores the new id", async () => {
    const { deps, link } = setup(
      {
        tabs: {
          create: vi.fn(async () => ({ id: 11 })),
          update: vi.fn(async () => {
            throw new Error("No tab with id: 7")
          }),
          remove: vi.fn(),
        },
      },
      EMPTY,
      LINK,
    )
    expect(await reopenSignIn(deps)).toEqual({ ok: true })
    expect(deps.tabs.create).toHaveBeenCalledWith({ url: LINK.signInUrl, active: true })
    expect(link()).toEqual({ ...LINK, signInTabId: 11 })
  })

  it("does nothing without a flow", async () => {
    const { deps } = setup()
    expect(await reopenSignIn(deps)).toEqual({ ok: false })
    expect(deps.tabs.update).not.toHaveBeenCalled()
    expect(deps.tabs.create).not.toHaveBeenCalled()
  })
})

describe("cancelSignIn", () => {
  it("clears the flow", async () => {
    const { deps, link } = setup({}, EMPTY, LINK)
    expect(await cancelSignIn(deps)).toEqual({ ok: true })
    expect(link()).toBeNull()
    expect(await pollLink(deps)).toEqual({ state: "idle" })
  })
})

describe("refresh", () => {
  it("without a token is unauthorized and does not call the server", async () => {
    const { deps } = setup()
    const r = await refresh(deps)
    expect(r).toMatchObject({ ok: false, code: "unauthorized" })
    expect(deps.fetchMe).not.toHaveBeenCalled()
  })

  it("stores me and fetchedAt on success", async () => {
    const { deps, state } = setup({}, { token: "t", me: null, fetchedAt: 0 })
    expect(await refresh(deps)).toEqual({ ok: true, me: ME })
    expect(state()).toEqual({ token: "t", me: ME, fetchedAt: NOW })
  })

  it("401 clears the token and me", async () => {
    const { deps, state } = setup(
      {
        fetchMe: vi.fn(async () => {
          throw new ProError("unauthorized", "signed out")
        }),
      },
      { token: "t", me: ME, fetchedAt: 5 },
    )
    expect(await refresh(deps)).toEqual({ ok: false, code: "unauthorized", message: "signed out" })
    expect(state()).toEqual(EMPTY)
  })

  it("other errors keep state and report the code", async () => {
    const initial = { token: "t", me: ME, fetchedAt: 5 }
    const { deps, state } = setup(
      {
        fetchMe: vi.fn(async () => {
          throw new ProError("internal_error", "boom")
        }),
      },
      initial,
    )
    expect(await refresh(deps)).toEqual({ ok: false, code: "internal_error", message: "boom" })
    expect(state()).toEqual(initial)
  })

  it("non-ProError failures map to network", async () => {
    const { deps } = setup(
      {
        fetchMe: vi.fn(async () => {
          throw new TypeError("x")
        }),
      },
      { token: "t", me: null, fetchedAt: 0 },
    )
    expect(await refresh(deps)).toMatchObject({ ok: false, code: "network" })
  })

  it("does not resurrect a token signed out mid-request", async () => {
    let state: ProState = { token: "t", me: null, fetchedAt: 0 }
    const { deps } = setup({
      store: {
        getValue: async () => state,
        setValue: async (v: ProState) => {
          state = v
        },
      },
      fetchMe: vi.fn(async () => {
        state = EMPTY
        return ME
      }),
    })
    await refresh(deps)
    expect(state).toEqual(EMPTY)
  })
})

describe("signOut", () => {
  it("disconnects and resets state", async () => {
    const { deps, state } = setup({}, { token: "t", me: ME, fetchedAt: 5 })
    expect(await signOut(deps)).toEqual({ ok: true })
    expect(deps.disconnect).toHaveBeenCalledWith("t")
    expect(state()).toEqual(EMPTY)
  })

  it("clears even when disconnect throws", async () => {
    const { deps, state } = setup(
      {
        disconnect: vi.fn(async () => {
          throw new Error("offline")
        }),
      },
      { token: "t", me: ME, fetchedAt: 5 },
    )
    expect(await signOut(deps)).toEqual({ ok: true })
    expect(state()).toEqual(EMPTY)
  })

  it("keeps a fresh sign-in that lands while disconnect is in flight", async () => {
    const fresh: ProState = { token: "new", me: null, fetchedAt: 0 }
    let state: ProState = { token: "old", me: ME, fetchedAt: 5 }
    const { deps } = setup({
      store: {
        getValue: async () => state,
        setValue: async (v: ProState) => {
          state = v
        },
      },
      disconnect: vi.fn(async () => {
        state = fresh
      }),
    })
    expect(await signOut(deps)).toEqual({ ok: true })
    expect(deps.disconnect).toHaveBeenCalledWith("old")
    expect(state).toEqual(fresh)
  })

  it("skips disconnect without a token", async () => {
    const { deps } = setup()
    expect(await signOut(deps)).toEqual({ ok: true })
    expect(deps.disconnect).not.toHaveBeenCalled()
  })
})

describe("registerProHandlers", () => {
  type Listener = (m: unknown, sender: unknown, sendResponse: (r: unknown) => void) => unknown
  function capture(deps: ProAuthDeps): Listener {
    let listener: Listener | undefined
    const spy = vi.spyOn(fakeBrowser.runtime.onMessage, "addListener").mockImplementation((fn) => {
      listener = fn as Listener
    })
    registerProHandlers(deps)
    spy.mockRestore()
    if (!listener) throw new Error("listener not registered")
    return listener
  }

  it.each([
    [{ type: "pro-link-start", returnUrl: null }, { ok: true }],
    [{ type: "pro-link-poll" }, { state: "idle" }],
    [{ type: "pro-link-reopen" }, { ok: false }],
    [{ type: "pro-link-cancel" }, { ok: true }],
    [{ type: "pro-sign-out" }, { ok: true }],
    [{ type: "pro-refresh" }, { ok: true, me: ME }],
  ])("%j returns true and responds asynchronously", async (message, expected) => {
    const { deps } = setup({}, { token: "t", me: null, fetchedAt: 0 })
    const listener = capture(deps)
    const sendResponse = vi.fn()
    expect(listener(message, {}, sendResponse)).toBe(true)
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith(expected))
  })

  it("passes the sending tab as the source tab", async () => {
    const { deps, link } = setup()
    const listener = capture(deps)
    const sendResponse = vi.fn()
    listener({ type: "pro-link-start", returnUrl: VIDEO }, { tab: { id: 42 } }, sendResponse)
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({ ok: true }))
    expect(link()?.sourceTabId).toBe(42)
  })

  it("a start message without a string or null returnUrl starts without one", async () => {
    const { deps } = setup()
    const listener = capture(deps)
    const sendResponse = vi.fn()
    listener({ type: "pro-link-start", returnUrl: 5 }, {}, sendResponse)
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({ ok: true }))
    expect(deps.tabs.create).toHaveBeenCalledWith({
      url: "https://recap.test/sign-in?link=c0de",
      active: true,
    })
  })

  it("ignores other messages, including the removed pro-sign-in", () => {
    const { deps } = setup()
    const listener = capture(deps)
    const sendResponse = vi.fn()
    expect(listener({ type: "toggle-panel" }, {}, sendResponse)).toBeUndefined()
    expect(listener({ type: "pro-sign-in" }, {}, sendResponse)).toBeUndefined()
    expect(sendResponse).not.toHaveBeenCalled()
  })
})
