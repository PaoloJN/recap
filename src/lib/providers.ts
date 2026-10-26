import { createAnthropic } from "@ai-sdk/anthropic"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createOpenAI } from "@ai-sdk/openai"
import type { LanguageModel } from "ai"
import type { ModelSelection, ProviderId } from "./types"

export interface ModelInfo {
  id: string
  label: string
}

export interface ProviderInfo {
  id: ProviderId
  label: string
  models: ModelInfo[]
  defaultModel: string
  keyUrl: string
}

export const PROVIDER_IDS: readonly ProviderId[] = ["openai", "anthropic", "google"]

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  openai: {
    id: "openai",
    label: "OpenAI",
    models: [
      { id: "gpt-6-luna", label: "GPT-6 Luna" },
      { id: "gpt-6.1-sol", label: "GPT-6.1 Sol" },
      { id: "gpt-6-astra", label: "GPT-6 Astra" },
    ],
    defaultModel: "gpt-6-luna",
    keyUrl: "https://platform.openai.com/api-keys",
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    models: [
      { id: "claude-haiku-5-5", label: "Claude Haiku 5.5" },
      { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5" },
      { id: "claude-opus-5-5", label: "Claude Opus 5.5" },
    ],
    defaultModel: "claude-haiku-5-5",
    keyUrl: "https://platform.claude.com/settings/keys",
  },
  google: {
    id: "google",
    label: "Google",
    models: [
      { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash" },
      { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite" },
      { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (preview)" },
    ],
    defaultModel: "gemini-3.8-flash",
    keyUrl: "https://aistudio.google.com/apikey",
  },
}

export function createModel(selection: ModelSelection, apiKey: string): LanguageModel {
  const { provider, model } = selection
  switch (provider) {
    case "openai":
      return createOpenAI({ apiKey })(model)
    case "anthropic":
      return createAnthropic({
        apiKey,
        headers: { "anthropic-dangerous-direct-browser-access": "true" },
      })(model)
    case "google":
      return createGoogleGenerativeAI({ apiKey })(model)
    default: {
      const unknown: never = provider
      throw new Error(`Unknown provider: ${unknown}`)
    }
  }
}
