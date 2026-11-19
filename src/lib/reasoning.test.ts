import { describe, expect, it } from "vitest"
import {
  isReasoningRejection,
  modelSupportsReasoning,
  reasoningProviderOptions,
  responsesReasoning,
  showsReasoningPicker,
} from "./reasoning"

describe("reasoning request building", () => {
  it("sends nothing for Tự động", () => {
    expect(responsesReasoning("gpt-6.1-sol", "auto")).toBeUndefined()
    expect(responsesReasoning("gpt-6.1-sol", undefined)).toBeUndefined()
    expect(reasoningProviderOptions("openai", "gpt-6.1-sol", "auto")).toBeUndefined()
    expect(reasoningProviderOptions("openrouter", "openai/gpt-6-luna", "auto")).toBeUndefined()
  })

  it("sends reasoning.effort for gpt-5 and gpt-6 reasoning models", () => {
    expect(modelSupportsReasoning("gpt-6.1-sol")).toBe(true)
    expect(modelSupportsReasoning("gpt-6-luna")).toBe(true)
    expect(modelSupportsReasoning("gpt-5.4")).toBe(true)
    expect(modelSupportsReasoning("openai/gpt-6.1-sol")).toBe(true)
    expect(responsesReasoning("gpt-6.1-sol", "high")).toEqual({ effort: "high" })
    expect(reasoningProviderOptions("openai", "gpt-6-luna", "low")).toEqual({
      openai: { reasoningEffort: "low" },
    })
    expect(reasoningProviderOptions("chatgpt", "gpt-5.4", "medium")).toEqual({
      openai: { reasoningEffort: "medium" },
    })
  })

  it("omits reasoning for models that do not support it", () => {
    expect(modelSupportsReasoning("gpt-4o")).toBe(false)
    expect(modelSupportsReasoning("gpt-5-chat-latest")).toBe(false)
    expect(responsesReasoning("gpt-4o", "high")).toBeUndefined()
    expect(reasoningProviderOptions("openai", "gpt-4o", "high")).toBeUndefined()
    expect(reasoningProviderOptions("chatgpt", "gpt-5-chat-latest", "low")).toBeUndefined()
  })

  it("passes OpenRouter reasoning and maps Anthropic and Google to a thinking budget", () => {
    expect(reasoningProviderOptions("openrouter", "any-model", "medium")).toEqual({
      openrouter: { reasoning: { effort: "medium" } },
    })
    expect(reasoningProviderOptions("anthropic", "claude-sonnet-5-5", "low")).toEqual({
      anthropic: { thinking: { type: "enabled", budgetTokens: 1024 } },
    })
    expect(reasoningProviderOptions("google", "gemini-3.8-flash", "high")).toEqual({
      google: { thinkingConfig: { thinkingBudget: 16384 } },
    })
    expect(showsReasoningPicker("anthropic")).toBe(true)
    expect(showsReasoningPicker("google")).toBe(true)
  })

  it("recognizes a rejected reasoning parameter", () => {
    expect(isReasoningRejection(400, "Unknown parameter: reasoning")).toBe(true)
    expect(isReasoningRejection(400, "invalid api key")).toBe(false)
  })
})
