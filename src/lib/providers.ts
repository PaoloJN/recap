import { createAnthropic } from "@ai-sdk/anthropic"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createOpenAI } from "@ai-sdk/openai"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import type { LanguageModel } from "ai"
import type { ModelSelection, ProviderId } from "./types"

export interface ModelInfo {
  id: string
  label: string
  note: string
}

export interface ProviderInfo {
  id: ProviderId
  label: string
  models: ModelInfo[]
  defaultModel: string
  keyUrl: string
  keyHint: string
  tagline: string
  tag: string
}

export const PROVIDER_IDS: readonly ProviderId[] = ["openai", "anthropic", "google", "openrouter"]

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  openai: {
    id: "openai",
    label: "OpenAI",
    models: [
      { id: "gpt-6-luna", label: "GPT-6 Luna", note: "Fast. Good for summaries" },
      { id: "gpt-6.1-sol", label: "GPT-6.1 Sol", note: "Slower. Better reasoning" },
      { id: "gpt-6-astra", label: "GPT-6 Astra", note: "Cheapest" },
    ],
    defaultModel: "gpt-6-luna",
    keyUrl: "https://platform.openai.com/api-keys",
    keyHint: "sk-…",
    tagline: "GPT-6 Luna, GPT-6.1 Sol",
    tag: "Most used",
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    models: [
      { id: "claude-haiku-5-5", label: "Claude Haiku 5.5", note: "Fast" },
      { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", note: "Best on long videos" },
      { id: "claude-opus-5-5", label: "Claude Opus 5.5", note: "Strongest reasoning" },
    ],
    defaultModel: "claude-haiku-5-5",
    keyUrl: "https://platform.claude.com/settings/keys",
    keyHint: "sk-ant-…",
    tagline: "Claude Haiku 5.5, Claude Sonnet 5.5",
    tag: "Long videos",
  },
  google: {
    id: "google",
    label: "Google",
    models: [
      { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash", note: "Fastest" },
      { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite", note: "Cheapest" },
      { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (preview)", note: "Deepest" },
    ],
    defaultModel: "gemini-3.8-flash",
    keyUrl: "https://aistudio.google.com/apikey",
    keyHint: "AIza…",
    tagline: "Gemini 3.8 Flash, Gemini 3.5 Flash-Lite",
    tag: "Free tier",
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    models: [
      { id: "openai/gpt-6-luna", label: "GPT-6 Luna", note: "Fast. Good for summaries" },
      {
        id: "anthropic/claude-sonnet-5.5",
        label: "Claude Sonnet 5.5",
        note: "Best on long videos",
      },
      { id: "google/gemini-3.8-flash", label: "Gemini 3.8 Flash", note: "Fastest" },
    ],
    defaultModel: "openai/gpt-6-luna",
    keyUrl: "https://openrouter.ai/settings/keys",
    keyHint: "sk-or-…",
    tagline: "One key, 300+ models",
    tag: "",
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
    case "openrouter":
      return createOpenRouter({ apiKey })(model)
    default: {
      const unknown: never = provider
      throw new Error(`Unknown provider: ${unknown}`)
    }
  }
}
