import { describe, expect, it, vi } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import { registerKeyCheckHandler, validateKey } from "./validate-key"

type Call = { url: string; headers: Record<string, string> }

function stub(responses: Array<Response | Error>) {
  const calls: Call[] = []
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), headers: (init?.headers ?? {}) as Record<string, string> })
    const next = responses.shift()
    if (!next) throw new Error("no response queued")
    if (next instanceof Error) throw next
    return next
  }) as typeof fetch
  return { calls, fetchFn }
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

describe("validateKey", () => {
  it("openai: lists model ids on 200 and sends a bearer header", async () => {
    const { calls, fetchFn } = stub([json({ data: [{ id: "gpt-6-luna" }, { id: "gpt-6-astra" }] })])
    const r = await validateKey("openai", "sk-x", fetchFn)
    expect(r).toEqual({ ok: true, models: ["gpt-6-luna", "gpt-6-astra"] })
    expect(calls[0]?.url).toBe("https://api.openai.com/v1/models")
    expect(calls[0]?.headers.Authorization).toBe("Bearer sk-x")
  })

  it("anthropic: sends x-api-key, version and browser-access headers", async () => {
    const { calls, fetchFn } = stub([json({ data: [{ id: "claude-haiku-5-5" }] })])
    const r = await validateKey("anthropic", "sk-ant-x", fetchFn)
    expect(r).toEqual({ ok: true, models: ["claude-haiku-5-5"] })
    expect(calls[0]?.url).toBe("https://api.anthropic.com/v1/models")
    expect(calls[0]?.headers["x-api-key"]).toBe("sk-ant-x")
    expect(calls[0]?.headers["anthropic-version"]).toBe("2023-06-01")
    expect(calls[0]?.headers["anthropic-dangerous-direct-browser-access"]).toBe("true")
  })

  it("google: uses the x-goog-api-key header and never the query string", async () => {
    const { calls, fetchFn } = stub([json({ models: [{ name: "models/gemini-3.8-flash" }] })])
    const r = await validateKey("google", "AIza", fetchFn)
    expect(r).toEqual({ ok: true, models: ["gemini-3.8-flash"] })
    expect(calls[0]?.url).not.toContain("key=")
    expect(calls[0]?.url).not.toContain("AIza")
    expect(calls[0]?.headers["x-goog-api-key"]).toBe("AIza")
  })

  it("openrouter: checks /auth/key, then reads the public model list", async () => {
    const { calls, fetchFn } = stub([
      json({ data: { label: "k" } }),
      json({ data: [{ id: "openai/gpt-6-luna" }] }),
    ])
    const r = await validateKey("openrouter", "sk-or-x", fetchFn)
    expect(r).toEqual({ ok: true, models: ["openai/gpt-6-luna"] })
    expect(calls[0]?.url).toBe("https://openrouter.ai/api/v1/auth/key")
    expect(calls[0]?.headers.Authorization).toBe("Bearer sk-or-x")
    expect(calls[1]?.url).toBe("https://openrouter.ai/api/v1/models")
  })

  it("openrouter: still ok with no models when the list fetch fails", async () => {
    const { fetchFn } = stub([json({ data: {} }), new Error("boom")])
    expect(await validateKey("openrouter", "k", fetchFn)).toEqual({ ok: true, models: [] })
  })

  it("openrouter: 401 from /auth/key is rejected and does not fetch /models", async () => {
    const { calls, fetchFn } = stub([json({}, 401)])
    const r = await validateKey("openrouter", "bad", fetchFn)
    expect(r).toEqual({ ok: false, status: 401, message: "OpenRouter rejected this key (401)" })
    expect(calls).toHaveLength(1)
  })

  it("401 maps to 'OpenAI rejected this key (401)'", async () => {
    const { fetchFn } = stub([json({}, 401)])
    expect(await validateKey("openai", "bad", fetchFn)).toEqual({
      ok: false,
      status: 401,
      message: "OpenAI rejected this key (401)",
    })
  })

  it("network failure maps to a connection message with status null", async () => {
    const { fetchFn } = stub([new TypeError("Failed to fetch")])
    expect(await validateKey("anthropic", "k", fetchFn)).toEqual({
      ok: false,
      status: null,
      message: "Couldn't reach Anthropic. Check your connection.",
    })
  })
})

describe("registerKeyCheckHandler", () => {
  // fakeBrowser's sendMessage does not relay listener return values, so call the listener directly.
  function capture() {
    let listener: ((m: unknown) => unknown) | undefined
    const spy = vi.spyOn(fakeBrowser.runtime.onMessage, "addListener").mockImplementation((fn) => {
      listener = fn as (m: unknown) => unknown
    })
    registerKeyCheckHandler()
    spy.mockRestore()
    if (!listener) throw new Error("listener not registered")
    return listener
  }

  it("answers validate-key with the validation result", async () => {
    const original = globalThis.fetch
    globalThis.fetch = (async () => json({ data: [{ id: "gpt-6-luna" }] })) as typeof fetch
    try {
      const listener = capture()
      const reply = await listener({ type: "validate-key", provider: "openai", key: "sk-x" })
      expect(reply).toEqual({ ok: true, models: ["gpt-6-luna"] })
    } finally {
      globalThis.fetch = original
    }
  })

  it("ignores other message types", () => {
    const listener = capture()
    expect(listener({ type: "toggle-panel" })).toBeUndefined()
  })
})
