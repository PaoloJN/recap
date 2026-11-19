import type { ProviderId } from "@/lib/types"

/** Shown when web search was requested and the provider cannot do it. */
export const WEB_NOTE = "không tra web được với provider này"

export type WebPlan = "responses" | "openrouter" | "none"

/** OpenAI and ChatGPT use the Responses `web_search` tool. OpenRouter uses `:online`. */
export function webPlan(provider: ProviderId): WebPlan {
  if (provider === "openai" || provider === "chatgpt") return "responses"
  if (provider === "openrouter") return "openrouter"
  return "none"
}

const WEB_REJECTION =
  /web[_ ]search|unsupported tool|tool use|tools? (?:are|is) not|unknown tool|invalid tool|plugin|:online|no endpoints found/i

export function isWebToolRejection(status: number | undefined, message: string): boolean {
  if (WEB_REJECTION.test(message)) return true
  return status === 404 && /model/i.test(message)
}

/** OpenRouter's web plugin is the `:online` model suffix. */
export function openRouterOnlineModel(model: string): string {
  const trimmed = model.trim()
  if (!trimmed || trimmed.endsWith(":online")) return trimmed
  return `${trimmed}:online`
}

export function appendWebNote(text: string): string {
  if (text.includes(WEB_NOTE)) return text
  const body = text.trim()
  return body ? `${body}\n\n${WEB_NOTE}` : WEB_NOTE
}
