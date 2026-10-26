import { describe, expect, it } from "vitest"
import { createModel, PROVIDER_IDS, PROVIDERS } from "./providers"
import type { ProviderId } from "./types"

describe("PROVIDERS", () => {
  it("lists every provider id", () => {
    expect([...PROVIDER_IDS]).toEqual(["openai", "anthropic", "google", "openrouter"])
  })
  it("includes each default model in its models", () => {
    for (const id of PROVIDER_IDS) {
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
  it("throws on unknown provider", () => {
    expect(() => createModel({ provider: "nope" as ProviderId, model: "x" }, "k")).toThrow(
      "Unknown provider: nope",
    )
  })
})
