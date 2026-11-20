import { isBuiltinUrl } from "./registry"

export type ToggleCommand = "toggle-panel" | "explain-moment" | "focus-mode"

export type AccessPlan =
  | { kind: "builtin" }
  | { kind: "ignore" }
  | { kind: "optional"; pattern: string }

export type AccessAction = "toggle" | "inject" | "request" | "ignore" | "unavailable"

/** `https://host/*` for a normal page. Extension, chrome, and file URLs are ignored. */
export function originPattern(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null
    return `${parsed.origin}/*`
  } catch {
    return null
  }
}

export function planSiteAccess(url: string | undefined): AccessPlan {
  if (!url) return { kind: "ignore" }
  if (isBuiltinUrl(url)) return { kind: "builtin" }
  const pattern = originPattern(url)
  if (!pattern) return { kind: "ignore" }
  return { kind: "optional", pattern }
}

/**
 * Alt+Y and the toolbar ask for an optional origin only when the page is not a built-in
 * site and the content script is not already there. Other commands never prompt.
 */
export function accessAction(
  plan: AccessPlan,
  input: { command: ToggleCommand; scriptReached: boolean; granted: boolean },
): AccessAction {
  if (plan.kind === "ignore") return "ignore"
  if (input.scriptReached) return "toggle"
  if (plan.kind === "builtin") return "unavailable"
  if (input.command !== "toggle-panel") return "unavailable"
  if (input.granted) return "inject"
  return "request"
}

export function rememberOrigin(granted: readonly string[], pattern: string): string[] {
  if (granted.includes(pattern)) return [...granted]
  return [...granted, pattern]
}

export function forgetMissing(
  granted: readonly string[],
  stillHeld: ReadonlySet<string>,
): string[] {
  return granted.filter((pattern) => stillHeld.has(pattern))
}
