import type { ProviderId } from "./types"

export type ReasoningEffort = "auto" | "low" | "medium" | "high"
export type ReasoningEffortValue = Exclude<ReasoningEffort, "auto">

export const REASONING_EFFORTS: readonly ReasoningEffort[] = ["auto", "low", "medium", "high"]

export const REASONING_EFFORT_LABELS: Record<ReasoningEffort, string> = {
  auto: "Tự động",
  low: "Low",
  medium: "Medium",
  high: "High",
}

/** Shown after one retry that dropped a rejected `reasoning` parameter. */
export const REASONING_NOTE =
  "Model này không nhận mức suy luận, nên đã gửi lại không kèm reasoning."

const THINKING_BUDGET: Record<ReasoningEffortValue, number> = {
  low: 1024,
  medium: 4096,
  high: 16384,
}

export function reasoningEffortValue(
  effort: ReasoningEffort | undefined,
): ReasoningEffortValue | undefined {
  if (!effort || effort === "auto") return undefined
  return effort
}

/**
 * GPT-5 / GPT-6 (except `gpt-5-chat`) and the o-series accept `reasoning.effort`.
 * Mirrors the AI SDK's reasoning-model check.
 */
export function modelSupportsReasoning(model: string): boolean {
  const id = model.trim().toLowerCase().split("/").pop() ?? ""
  if (/^o\d+(?:-|$)/.test(id)) return true
  const gpt = /^gpt-(\d+)(?:\.(\d+))?(?:-(.+))?$/.exec(id)
  if (!gpt) return false
  const major = Number(gpt[1])
  if (major < 5) return false
  const minor = gpt[2]
  const variant = gpt[3]
  const chatOnly = minor === undefined && (variant?.startsWith("chat") ?? false)
  return !chatOnly
}

/** Body field for the OpenAI / ChatGPT Responses API. Omitted when effort is automatic or the model is not a reasoning model. */
export function responsesReasoning(
  model: string,
  effort: ReasoningEffort | undefined,
): { effort: ReasoningEffortValue } | undefined {
  const value = reasoningEffortValue(effort)
  if (!value || !modelSupportsReasoning(model)) return undefined
  return { effort: value }
}

export function showsReasoningPicker(provider: ProviderId): boolean {
  return (
    provider === "openai" ||
    provider === "chatgpt" ||
    provider === "openrouter" ||
    provider === "anthropic" ||
    provider === "google"
  )
}

export type ReasoningProviderOptions =
  | { openai: { reasoningEffort: ReasoningEffortValue } }
  | { openrouter: { reasoning: { effort: ReasoningEffortValue } } }
  | { anthropic: { thinking: { type: "enabled"; budgetTokens: number } } }
  | { google: { thinkingConfig: { thinkingBudget: number } } }

/** Provider options for the AI SDK. `undefined` means send nothing. */
export function reasoningProviderOptions(
  provider: ProviderId,
  model: string,
  effort: ReasoningEffort | undefined,
): ReasoningProviderOptions | undefined {
  const value = reasoningEffortValue(effort)
  if (!value || !showsReasoningPicker(provider)) return undefined
  if (provider === "openai" || provider === "chatgpt") {
    return modelSupportsReasoning(model) ? { openai: { reasoningEffort: value } } : undefined
  }
  if (provider === "openrouter") return { openrouter: { reasoning: { effort: value } } }
  const budget = THINKING_BUDGET[value]
  if (provider === "anthropic") {
    return { anthropic: { thinking: { type: "enabled", budgetTokens: budget } } }
  }
  return { google: { thinkingConfig: { thinkingBudget: budget } } }
}

export function isReasoningRejection(status: number | undefined, message: string): boolean {
  if (!/reasoning/i.test(message)) return false
  if (status === undefined) return true
  return status === 400 || status === 404 || status === 422
}
