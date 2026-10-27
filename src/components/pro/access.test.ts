import { describe, expect, it } from "vitest"
import { DEFAULT_SETTINGS, type Settings } from "@/lib/storage"
import { StreamError } from "@/lib/transport"
import { access, errorInfo, gateFor, inlineErrorCopy, resetsLine } from "./access"

const s = (provider: Settings["provider"]): Settings => ({ ...DEFAULT_SETTINGS, provider })
const ON = { enabled: true, signedIn: true }
const OUT = { enabled: true, signedIn: false }
const OFF = { enabled: false, signedIn: false }

describe("access", () => {
  it.each([
    ["pro, signed in", s("pro"), {}, ON, "ok"],
    ["pro, signed out", s("pro"), {}, OUT, "needs-sign-in"],
    ["pro in a build without Pro", s("pro"), {}, OFF, "needs-key"],
    ["byok with key, Pro on", s("openai"), { openai: "sk" }, OUT, "ok"],
    ["byok with key, Pro off", s("openai"), { openai: "sk" }, OFF, "ok"],
    ["byok without key, Pro on", s("openai"), {}, OUT, "needs-sign-in"],
    ["byok without key, Pro on and signed in", s("openai"), {}, ON, "needs-sign-in"],
    ["byok without key, Pro off", s("openai"), {}, OFF, "needs-key"],
    ["byok with another provider's key", s("anthropic"), { openai: "sk" }, OFF, "needs-key"],
    ["keys not loaded yet", s("openai"), undefined, OFF, "needs-key"],
  ] as const)("%s", (_name, settings, keys, pro, expected) => {
    expect(access(settings, keys, pro)).toBe(expected)
  })
})

describe("gateFor", () => {
  it.each([
    ["upgrade_required", "upgrade"],
    ["limit_reached", "limit"],
    ["unauthorized", "signed-out"],
    ["rate_limited", null],
    ["too_large", null],
    ["model_unavailable", null],
    ["bad_request", null],
    ["network", null],
    ["internal_error", null],
    [undefined, null],
  ] as const)("%s → %s", (code, gate) => {
    expect(gateFor(code)).toBe(gate)
  })
})

describe("inlineErrorCopy", () => {
  it("picks copy by code for Recap Pro", () => {
    expect(inlineErrorCopy("rate_limited", "summary", true)).toBe(
      "Too many requests. Try again in a few minutes.",
    )
    expect(inlineErrorCopy("too_large", "chat", true)).toBe(
      "This chat is too long for one request. Start a new chat.",
    )
    expect(inlineErrorCopy("model_unavailable", "chat", true)).toBe(
      "Recap Pro can't reach the model right now. Try again in a minute.",
    )
    expect(inlineErrorCopy("network", "summary", true)).toBe(
      "Can't reach Recap Pro. Check your connection.",
    )
  })

  it("falls back to the message for other codes and for your own key", () => {
    expect(inlineErrorCopy("too_large", "summary", true)).toBeNull()
    expect(inlineErrorCopy("internal_error", "chat", true)).toBeNull()
    expect(inlineErrorCopy(undefined, "chat", true)).toBeNull()
    expect(inlineErrorCopy("network", "chat", false)).toBeNull()
  })
})

describe("errorInfo", () => {
  it("reads code and resetsAt from a StreamError", () => {
    const err = new StreamError("x", { code: "limit_reached", resetsAt: "2026-11-01T00:00:00Z" })
    expect(errorInfo(err)).toEqual({ code: "limit_reached", resetsAt: "2026-11-01T00:00:00Z" })
  })

  it("is empty for plain errors and non-errors", () => {
    expect(errorInfo(new Error("x"))).toEqual({})
    expect(errorInfo("x")).toEqual({})
    expect(errorInfo(undefined)).toEqual({})
  })
})

describe("resetsLine", () => {
  it("formats the reset date in UTC", () => {
    expect(resetsLine("2026-11-01T00:00:00Z")).toBe("Resets Nov 1.")
  })

  it("says next month when the date is missing or invalid", () => {
    expect(resetsLine(undefined)).toBe("Resets next month.")
    expect(resetsLine(null)).toBe("Resets next month.")
    expect(resetsLine("nope")).toBe("Resets next month.")
  })
})
