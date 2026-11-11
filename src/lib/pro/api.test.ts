import { describe, expect, it, vi } from "vitest"
import {
  claimLink,
  disconnect,
  fetchMe,
  fetchPricing,
  ProError,
  startLink,
  streamRequest,
  toProError,
} from "./api"
import type { MeResponse } from "./types"

vi.mock("./config", () => ({
  PRO_ORIGIN: "https://pro.test",
  PRO_ENABLED: true,
  proUrl: (path: string) => `https://pro.test${path}`,
}))

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

const ME: MeResponse = {
  user: { email: "a@b.c", name: "A", image: null },
  plan: "trial",
  usage: { summaries: 1, chats: 2, summaryLimit: 10, chatLimit: 20, resetsAt: null },
  subscription: null,
}

describe("toProError", () => {
  it.each([
    [400, "bad_request"],
    [401, "unauthorized"],
    [402, "upgrade_required"],
    [413, "too_large"],
    [429, "rate_limited"],
    [503, "model_unavailable"],
    [500, "internal_error"],
  ] as const)("maps JSON error code %s → %s and keeps the message", async (status, code) => {
    const err = await toProError(json(status, { error: code, message: `server says ${code}` }))
    expect(err).toBeInstanceOf(ProError)
    expect(err.code).toBe(code)
    expect(err.message).toBe(`server says ${code}`)
  })

  it("maps limit_reached with resetsAt", async () => {
    const resetsAt = "2026-11-01T00:00:00.000Z"
    const err = await toProError(
      json(429, { error: "limit_reached", message: "Monthly limit reached", resetsAt }),
    )
    expect(err.code).toBe("limit_reached")
    expect(err.resetsAt).toBe(resetsAt)
    expect(err.message).toBe("Monthly limit reached")
  })

  it.each([
    [400, "bad_request"],
    [401, "unauthorized"],
    [402, "upgrade_required"],
    [413, "too_large"],
    [429, "rate_limited"],
    [503, "model_unavailable"],
    [500, "internal_error"],
    [418, "internal_error"],
  ] as const)("falls back to status %s → %s for an unparseable body", async (status, code) => {
    const err = await toProError(new Response("<html>oops</html>", { status }))
    expect(err.code).toBe(code)
    expect(err.message.length).toBeGreaterThan(0)
  })

  it("uses the bad_request default message for a bare 400", async () => {
    const err = await toProError(new Response("", { status: 400 }))
    expect(err.message).toBe(
      "Recap Pro couldn't read that request. Update the extension and try again.",
    )
  })

  it("falls back to status for an unknown error code", async () => {
    const err = await toProError(json(402, { error: "something_new", message: "Pay up" }))
    expect(err.code).toBe("upgrade_required")
    expect(err.message).toBe("Pay up")
  })
})

describe("fetchMe", () => {
  it("sends x-api-key to /api/v1/me and returns the body", async () => {
    const fetchImpl = vi.fn(async () => json(200, ME))
    await expect(fetchMe("tok", fetchImpl)).resolves.toEqual(ME)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("https://pro.test/api/v1/me")
    expect(new Headers(init.headers).get("x-api-key")).toBe("tok")
  })

  it("throws a ProError on 401", async () => {
    const fetchImpl = vi.fn(async () => json(401, { error: "unauthorized", message: "Bad key" }))
    await expect(fetchMe("tok", fetchImpl)).rejects.toMatchObject({ code: "unauthorized" })
  })

  it("maps a network rejection to network", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch")
    })
    await expect(fetchMe("tok", fetchImpl)).rejects.toMatchObject({
      code: "network",
      message: "Can't reach Recap Pro. Check your connection.",
    })
  })
})

describe("2xx with a non-JSON body", () => {
  const html = () => new Response("<html>proxy</html>", { status: 200 })
  it("fetchMe maps it to internal_error", async () => {
    const err = await fetchMe(
      "tok",
      vi.fn(async () => html()),
    ).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ProError)
    expect(err).toMatchObject({ code: "internal_error" })
  })
  it("fetchPricing maps it to internal_error", async () => {
    const err = await fetchPricing(vi.fn(async () => html())).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ProError)
    expect(err).toMatchObject({ code: "internal_error" })
  })
})

describe("fetchPricing", () => {
  it("GETs /api/v1/pricing without a key", async () => {
    const pricing = { monthly: { display: "$5" }, yearly: { display: "$50" } }
    const fetchImpl = vi.fn(async () => json(200, pricing))
    await expect(fetchPricing(fetchImpl)).resolves.toEqual(pricing)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit | undefined]
    expect(url).toBe("https://pro.test/api/v1/pricing")
    expect(new Headers(init?.headers).has("x-api-key")).toBe(false)
  })
})

describe("disconnect", () => {
  it("POSTs /api/v1/disconnect with the key", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }))
    await disconnect("tok", fetchImpl)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("https://pro.test/api/v1/disconnect")
    expect(init.method).toBe("POST")
    expect(new Headers(init.headers).get("x-api-key")).toBe("tok")
  })

  it("swallows network errors and error statuses", async () => {
    await expect(
      disconnect(
        "tok",
        vi.fn(async () => {
          throw new TypeError("Failed to fetch")
        }),
      ),
    ).resolves.toBeUndefined()
    await expect(
      disconnect(
        "tok",
        vi.fn(async () => json(500, { error: "internal_error", message: "x" })),
      ),
    ).resolves.toBeUndefined()
  })
})

describe("streamRequest", () => {
  const body = {
    kind: "chat" as const,
    system: "sys",
    messages: [{ role: "user" as const, content: "hi" }],
  }

  it("POSTs JSON with the key and signal and returns the response on 2xx", async () => {
    const res = new Response("data: [DONE]\n\n", {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    })
    const fetchImpl = vi.fn(async () => res)
    const signal = new AbortController().signal
    await expect(streamRequest("tok", body, signal, fetchImpl)).resolves.toBe(res)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("https://pro.test/api/v1/stream")
    expect(init.method).toBe("POST")
    expect(init.signal).toBe(signal)
    const headers = new Headers(init.headers)
    expect(headers.get("x-api-key")).toBe("tok")
    expect(headers.get("content-type")).toBe("application/json")
    expect(JSON.parse(init.body as string)).toEqual(body)
  })

  it("throws the mapped ProError on non-2xx", async () => {
    const fetchImpl = vi.fn(async () =>
      json(429, { error: "limit_reached", message: "Limit", resetsAt: "2026-11-01T00:00:00Z" }),
    )
    await expect(
      streamRequest("tok", body, new AbortController().signal, fetchImpl),
    ).rejects.toMatchObject({ code: "limit_reached", resetsAt: "2026-11-01T00:00:00Z" })
  })

  it("maps a network rejection to network", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch")
    })
    const err = await streamRequest("tok", body, new AbortController().signal, fetchImpl).catch(
      (e: unknown) => e,
    )
    expect(err).toBeInstanceOf(ProError)
    expect(err).toMatchObject({
      code: "network",
      message: "Can't reach Recap Pro. Check your connection.",
    })
  })

  it("lets an AbortError propagate unchanged", async () => {
    const abort = new DOMException("The operation was aborted.", "AbortError")
    const fetchImpl = vi.fn(async () => {
      throw abort
    })
    const err = await streamRequest("tok", body, new AbortController().signal, fetchImpl).catch(
      (e: unknown) => e,
    )
    expect(err).toBe(abort)
  })
})

describe("startLink", () => {
  it("POSTs the challenge and browser as JSON and returns the code", async () => {
    const body = { code: "c0de", expiresAt: "2026-10-30T12:30:00.000Z" }
    const fetchImpl = vi.fn(async () => json(200, body))
    await expect(startLink("chal", "firefox", fetchImpl)).resolves.toEqual(body)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("https://pro.test/api/v1/link")
    expect(init.method).toBe("POST")
    expect(new Headers(init.headers).get("content-type")).toBe("application/json")
    expect(new Headers(init.headers).has("x-api-key")).toBe(false)
    expect(JSON.parse(init.body as string)).toEqual({ challenge: "chal", browser: "firefox" })
  })

  it("throws bad_request on 400", async () => {
    const fetchImpl = vi.fn(async () => json(400, { error: "bad_request", message: "Bad" }))
    await expect(startLink("chal", "chrome", fetchImpl)).rejects.toMatchObject({
      code: "bad_request",
    })
  })

  it("maps a network rejection to network", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch")
    })
    await expect(startLink("chal", "chrome", fetchImpl)).rejects.toMatchObject({ code: "network" })
  })

  it("rejects a 2xx body without a code", async () => {
    const fetchImpl = vi.fn(async () => json(200, { expiresAt: "x" }))
    await expect(startLink("chal", "chrome", fetchImpl)).rejects.toMatchObject({
      code: "internal_error",
    })
  })
})

describe("claimLink", () => {
  it("POSTs the code and verifier as JSON", async () => {
    const fetchImpl = vi.fn(async () => json(200, { status: "pending" }))
    await expect(claimLink("c0de", "ver", fetchImpl)).resolves.toEqual({ status: "pending" })
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("https://pro.test/api/v1/link/claim")
    expect(init.method).toBe("POST")
    expect(new Headers(init.headers).get("content-type")).toBe("application/json")
    expect(JSON.parse(init.body as string)).toEqual({ code: "c0de", verifier: "ver" })
  })

  it.each([
    [{ status: "approved", key: "k", finished: false }],
    [{ status: "approved", key: "k", finished: true }],
    [{ status: "claimed", finished: false }],
    [{ status: "claimed", finished: true }],
  ])("returns %j", async (body) => {
    await expect(
      claimLink(
        "c",
        "v",
        vi.fn(async () => json(200, body)),
      ),
    ).resolves.toEqual(body)
  })

  it("maps 410 to expired", async () => {
    const fetchImpl = vi.fn(async () => json(410, { error: "expired", message: "Expired" }))
    await expect(claimLink("c", "v", fetchImpl)).resolves.toEqual({ status: "expired" })
  })

  it("throws bad_request on 400", async () => {
    const fetchImpl = vi.fn(async () => json(400, { error: "bad_request", message: "Bad" }))
    await expect(claimLink("c", "v", fetchImpl)).rejects.toMatchObject({ code: "bad_request" })
  })

  it("maps a network rejection to network", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch")
    })
    const err = await claimLink("c", "v", fetchImpl).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ProError)
    expect(err).toMatchObject({ code: "network" })
  })

  it.each([
    [{ status: "approved", finished: true }],
    [{ status: "approved", key: "", finished: true }],
    [{ status: "claimed" }],
    [{ status: "weird" }],
    [null],
  ])("rejects a malformed body %j", async (body) => {
    await expect(
      claimLink(
        "c",
        "v",
        vi.fn(async () => json(200, body)),
      ),
    ).rejects.toMatchObject({ code: "internal_error" })
  })
})
