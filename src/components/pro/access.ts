import { shortDate } from "@/lib/pro/plan-copy"
import type { ProErrorCode } from "@/lib/pro/types"
import { isByok } from "@/lib/providers"
import type { ApiKeys, Settings } from "@/lib/storage"

export type Access = "ok" | "needs-sign-in" | "needs-key"

/** Whether Summary and Chat can run with the current provider, and if not, which gate to show. */
export function access(
  settings: Pick<Settings, "provider">,
  apiKeys: ApiKeys | undefined,
  pro: { enabled: boolean; signedIn: boolean },
): Access {
  const { provider } = settings
  if (!isByok(provider)) {
    // Settings never hold "pro" in a build without it; if they somehow do, it is a missing key.
    if (!pro.enabled) return "needs-key"
    return pro.signedIn ? "ok" : "needs-sign-in"
  }
  if (apiKeys?.[provider]) return "ok"
  return pro.enabled ? "needs-sign-in" : "needs-key"
}

export type Gate = "upgrade" | "limit" | "signed-out"

/** Recap Pro errors that replace the body with a gate; everything else is an inline error. */
export function gateFor(code: ProErrorCode | undefined): Gate | null {
  switch (code) {
    case "upgrade_required":
      return "upgrade"
    case "limit_reached":
      return "limit"
    case "unauthorized":
      return "signed-out"
    default:
      return null
  }
}

/**
 * User-facing copy for a Recap Pro inline error, chosen by code. Null means "show the message the
 * background sent" (other codes, or your own key, whose errors carry the provider's message).
 */
export function inlineErrorCopy(
  code: ProErrorCode | undefined,
  kind: "summary" | "chat",
  pro: boolean,
): string | null {
  if (!pro) return null
  switch (code) {
    case "rate_limited":
      return "Too many requests. Try again in a few minutes."
    case "too_large":
      return kind === "chat" ? "This chat is too long for one request. Start a new chat." : null
    case "model_unavailable":
      return "Recap Pro can't reach the model right now. Try again in a minute."
    case "network":
      return "Can't reach Recap Pro. Check your connection."
    default:
      return null
  }
}

/** The Recap Pro `code`/`resetsAt` carried by a stream error (a `StreamError`), if any. */
export function errorInfo(err: unknown): { code?: ProErrorCode; resetsAt?: string } {
  if (typeof err !== "object" || err === null) return {}
  const { code, resetsAt } = err as { code?: unknown; resetsAt?: unknown }
  return {
    ...(typeof code === "string" ? { code: code as ProErrorCode } : {}),
    ...(typeof resetsAt === "string" ? { resetsAt } : {}),
  }
}

/** "Resets Nov 1." for the limit gate, or "Resets next month." without a usable date. */
export function resetsLine(resetsAt: string | null | undefined): string {
  if (!resetsAt || Number.isNaN(Date.parse(resetsAt))) return "Resets next month."
  return `Resets ${shortDate(resetsAt)}.`
}
