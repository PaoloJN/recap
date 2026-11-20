import { describe, expect, it } from "vitest"
import { createModel } from "./providers"
import type { ProviderId } from "./types"

const CASES: { provider: ProviderId; model: string; providerId: string }[] = [
  { provider: "openai", model: "gpt-6-luna", providerId: "openai.responses" },
  { provider: "anthropic", model: "claude-haiku-5-5", providerId: "anthropic.messages" },
  { provider: "google", model: "gemini-3.8-flash", providerId: "google.generative-ai" },
  { provider: "openrouter", model: "openai/gpt-6-luna", providerId: "openrouter" },
]

describe("createModel", () => {
  it.each(CASES)(
    "builds a $provider model without a network call",
    ({ provider, model, providerId }) => {
      const created = createModel({ provider, model }, "test-key")
      if (typeof created === "string") {
        expect(created).toBe(model)
        return
      }
      expect(created.modelId).toBe(model)
      expect(created.provider).toBe(providerId)
    },
  )
})
