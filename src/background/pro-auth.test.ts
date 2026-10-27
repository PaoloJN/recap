import { describe, expect, it, vi } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import { ProError } from "@/lib/pro/api"
import type { MeResponse, ProState } from "@/lib/pro/types"
import {
  type ProAuthDeps,
  parseTokenFromRedirect,
  refresh,
  registerProHandlers,
  signIn,
  signOut,
} from "./pro-auth"

vi.mock("@/lib/pro/config", () => ({
  PRO_ORIGIN: "https://recap.test",
  PRO_ENABLED: true,
  proUrl: (path: string) => `https://recap.test${path}`,
}))

const REDIRECT = "https://abc.chromiumapp.org/connect"

const ME: MeResponse = {
  user: { email: "a@b.c", name: "A", image: null },
  plan: "trial",
  usage: { summaries: 1, chats: 0, summaryLimit: 10, chatLimit: 20, resetsAt: null },
  subscription: null,
}

const EMPTY: ProState = { token: null, me: null, fetchedAt: 0 }

function setup(overrides: Partial<ProAuthDeps> = {}, initial: ProState = EMPTY) {
  let state = initial
  const store = {
    getValue: vi.fn(async () => state),
    setValue: vi.fn(async (v: ProState) => {
      state = v
    }),
  }
  const deps: ProAuthDeps = {
    store,
    fetchMe: vi.fn(async () => ME),
    disconnect: vi.fn(async () => {}),
    launchWebAuthFlow: vi.fn(async () => `${REDIRECT}#token=key%2Babc`),
    getRedirectURL: vi.fn(() => REDIRECT),
    browser: "chrome",
    now: () => 1234,
    ...overrides,
  }
  return { deps, state: () => state }
}

describe("parseTokenFromRedirect", () => {
  it("reads and URL-decodes the fragment token", () => {
    expect(parseTokenFromRedirect(`${REDIRECT}#token=a%2Bb%3D`)).toBe("a+b=")
  })

  it("rejects missing, empty or malformed redirects", () => {
    expect(parseTokenFromRedirect(undefined)).toBeNull()
    expect(parseTokenFromRedirect("")).toBeNull()
    expect(parseTokenFromRedirect(REDIRECT)).toBeNull()
    expect(parseTokenFromRedirect(`${REDIRECT}#token=`)).toBeNull()
    expect(parseTokenFromRedirect(`${REDIRECT}#other=1`)).toBeNull()
    expect(parseTokenFromRedirect(`${REDIRECT}#token=%E0%A4%A`)).toBeNull()
  })
})

describe("signIn", () => {
  it("opens the connect URL with an encoded redirect and browser param", async () => {
    const { deps } = setup({ browser: "firefox" })
    await signIn(deps)
    expect(deps.getRedirectURL).toHaveBeenCalledWith("connect")
    expect(deps.launchWebAuthFlow).toHaveBeenCalledWith({
      url: `https://recap.test/extension/connect?redirect_uri=${encodeURIComponent(REDIRECT)}&browser=firefox`,
      interactive: true,
    })
  })

  it("stores the parsed token, then refreshes me", async () => {
    const { deps, state } = setup()
    expect(await signIn(deps)).toEqual({ ok: true })
    expect(deps.fetchMe).toHaveBeenCalledWith("key+abc")
    expect(state()).toEqual({ token: "key+abc", me: ME, fetchedAt: 1234 })
  })

  it.each([
    "The user did not approve access.",
    "User cancelled",
    "Authorization page could not be loaded. User canceled",
    "User cancelled or denied",
  ])("treats %j as cancelled and stores nothing", async (message) => {
    const { deps, state } = setup({
      launchWebAuthFlow: vi.fn(async () => {
        throw new Error(message)
      }),
    })
    const r = await signIn(deps)
    expect(r).toMatchObject({ ok: false, reason: "cancelled" })
    expect(state()).toEqual(EMPTY)
  })

  it("other rejections fail", async () => {
    const { deps } = setup({
      launchWebAuthFlow: vi.fn(async () => {
        throw new Error("Network down")
      }),
    })
    expect(await signIn(deps)).toEqual({
      ok: false,
      reason: "failed",
      message: "Couldn't sign in. Try again.",
    })
  })

  it("a malformed redirect fails without storing", async () => {
    const { deps, state } = setup({ launchWebAuthFlow: vi.fn(async () => `${REDIRECT}#nope`) })
    expect(await signIn(deps)).toEqual({
      ok: false,
      reason: "failed",
      message: "Couldn't sign in. Try again.",
    })
    expect(state()).toEqual(EMPTY)
  })

  it("a non-401 refresh failure still counts as signed in", async () => {
    const { deps, state } = setup({
      fetchMe: vi.fn(async () => {
        throw new ProError("network", "offline")
      }),
    })
    expect(await signIn(deps)).toEqual({ ok: true })
    expect(state()).toEqual({ token: "key+abc", me: null, fetchedAt: 0 })
  })

  it("a 401 right after sign-in fails and leaves no token", async () => {
    const { deps, state } = setup({
      fetchMe: vi.fn(async () => {
        throw new ProError("unauthorized", "nope")
      }),
    })
    expect(await signIn(deps)).toMatchObject({ ok: false, reason: "failed" })
    expect(state().token).toBeNull()
  })

  it("a second sign-in while one is in flight reuses it", async () => {
    let finish: (url: string) => void = () => {}
    const { deps } = setup({
      launchWebAuthFlow: vi.fn(
        () =>
          new Promise<string>((resolve) => {
            finish = resolve
          }),
      ),
    })
    const a = signIn(deps)
    const b = signIn(deps)
    expect(a).toBe(b)
    finish(`${REDIRECT}#token=t`)
    expect(await a).toEqual({ ok: true })
    expect(deps.launchWebAuthFlow).toHaveBeenCalledTimes(1)
    // Once settled, a new sign-in opens a new window.
    const c = signIn(deps)
    expect(c).not.toBe(a)
    expect(deps.launchWebAuthFlow).toHaveBeenCalledTimes(2)
    finish(`${REDIRECT}#token=t2`)
    expect(await c).toEqual({ ok: true })
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
    expect(state()).toEqual({ token: "t", me: ME, fetchedAt: 1234 })
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
    [{ type: "pro-sign-in" }, { ok: true }],
    [{ type: "pro-sign-out" }, { ok: true }],
    [{ type: "pro-refresh" }, { ok: true, me: ME }],
  ])("%j returns true and responds asynchronously", async (message, expected) => {
    const { deps } = setup({}, { token: "t", me: null, fetchedAt: 0 })
    const listener = capture(deps)
    const sendResponse = vi.fn()
    expect(listener(message, {}, sendResponse)).toBe(true)
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith(expected))
  })

  it("ignores other messages", () => {
    const { deps } = setup()
    const listener = capture(deps)
    const sendResponse = vi.fn()
    expect(listener({ type: "toggle-panel" }, {}, sendResponse)).toBeUndefined()
    expect(sendResponse).not.toHaveBeenCalled()
  })
})
