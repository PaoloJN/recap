import { afterEach, describe, expect, it, vi } from "vitest"
import { BYOK_PROVIDER_IDS, createModel, isByok, PROVIDERS } from "./providers"
import type { ProviderId } from "./types"

// Pro on/off is a build-time constant, so these tests swap `@/lib/pro/config` with
// `vi.doMock` (the non-hoisted vi.mock) and re-import providers after `vi.resetModules`.
async function loadProviders(proEnabled: boolean) {
  vi.resetModules()
  vi.doMock("@/lib/pro/config", () => ({
    PRO_ENABLED: proEnabled,
    PRO_ORIGIN: proEnabled ? "https://recapai.dev" : null,
    proUrl: (path: string) => `https://recapai.dev${path}`,
  }))
  return import("./providers")
}

afterEach(() => {
  vi.doUnmock("@/lib/pro/config")
})

describe("PROVIDERS", () => {
  it("lists every BYOK provider id", () => {
    expect([...BYOK_PROVIDER_IDS]).toEqual(["openai", "anthropic", "google", "openrouter"])
  })
  it("lists Recap Pro first only when Pro is enabled", async () => {
    const on = await loadProviders(true)
    expect(on.PROVIDER_IDS[0]).toBe("pro")
    expect([...on.PROVIDER_IDS]).toEqual(["pro", ...BYOK_PROVIDER_IDS])
    const off = await loadProviders(false)
    expect(off.PROVIDER_IDS).not.toContain("pro")
    expect([...off.PROVIDER_IDS]).toEqual([...BYOK_PROVIDER_IDS])
  })
  it("describes Recap Pro", () => {
    expect(PROVIDERS.pro).toMatchObject({ id: "pro", label: "Recap Pro", defaultModel: "pro" })
  })
  it("isByok separates Pro from key providers", () => {
    expect(isByok("pro")).toBe(false)
    for (const id of BYOK_PROVIDER_IDS) expect(isByok(id)).toBe(true)
  })
  it("includes each default model in its models", () => {
    for (const id of ["pro", ...BYOK_PROVIDER_IDS] as ProviderId[]) {
      const info = PROVIDERS[id]
      expect(info.models.map((m) => m.id)).toContain(info.defaultModel)
    }
  })
})

describe("createModel", () => {
  it("creates an OpenAI model", () => {
    const m = createModel({ provider: "openai", model: "gpt-6-luna" }, "k")
    expect(typeof m).not.toBe("string")
    if (typeof m !== "string") {
      expect(m.modelId).toBe("gpt-6-luna")
      expect(m.provider).toContain("openai")
    }
  })
  it("creates an Anthropic model", () => {
    const m = createModel({ provider: "anthropic", model: "claude-haiku-5-5" }, "k")
    if (typeof m !== "string") {
      expect(m.modelId).toBe("claude-haiku-5-5")
      expect(m.provider).toContain("anthropic")
    }
  })
  it("creates a Google model", () => {
    const m = createModel({ provider: "google", model: "gemini-3.8-flash" }, "k")
    if (typeof m !== "string") {
      expect(m.modelId).toBe("gemini-3.8-flash")
      expect(m.provider).toContain("google")
    }
  })
  it("creates an OpenRouter model", () => {
    const m = createModel({ provider: "openrouter", model: "openai/gpt-6-luna" }, "k")
    if (typeof m !== "string") expect(m.modelId).toBe("openai/gpt-6-luna")
  })
  it("throws for Recap Pro", () => {
    // @ts-expect-error createModel only accepts BYOK selections
    expect(() => createModel({ provider: "pro", model: "pro" }, "k")).toThrow()
  })
  it("throws on unknown provider", () => {
    expect(() => createModel({ provider: "nope" as never, model: "x" }, "k")).toThrow(
      "Unknown provider: nope",
    )
  })
})
