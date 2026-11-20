import { browser } from "wxt/browser"
import type { ToggleMessage } from "@/lib/port-protocol"
import {
  accessAction,
  forgetMissing,
  planSiteAccess,
  rememberOrigin,
  type ToggleCommand,
} from "@/lib/source/access"
import { grantedOriginsItem } from "@/lib/storage"

export const OPTIONAL_SCRIPT_ID = "recap-optional"
/** Built path of `course.content`. Confirmed against the WXT output. */
export const COURSE_SCRIPT = "/content-scripts/course.js"

export async function registerOptionalScripts(patterns: readonly string[]): Promise<void> {
  if (patterns.length === 0) return
  const existing = await browser.scripting
    .getRegisteredContentScripts({ ids: [OPTIONAL_SCRIPT_ID] })
    .catch(() => [])
  if (existing.length > 0) {
    await browser.scripting.unregisterContentScripts({ ids: [OPTIONAL_SCRIPT_ID] })
  }
  await browser.scripting.registerContentScripts([
    {
      id: OPTIONAL_SCRIPT_ID,
      js: [COURSE_SCRIPT],
      matches: [...patterns],
      runAt: "document_idle",
      persistAcrossSessions: false,
    },
  ])
}

/** Opens the panel once on the tab that asked, then loads the course script into it. */
export async function injectCourseScript(tabId: number): Promise<void> {
  await browser.scripting.executeScript({
    target: { tabId },
    func: () => {
      sessionStorage.setItem("recap-pending-toggle", "1")
    },
  })
  await browser.scripting.executeScript({
    target: { tabId },
    files: [COURSE_SCRIPT],
  })
}

/** Drop origins the user revoked, and register the content script for the ones still held. */
export async function syncGrantedOrigins(): Promise<string[]> {
  const stored = await grantedOriginsItem.getValue()
  const held = new Set<string>()
  for (const pattern of stored) {
    if (await browser.permissions.contains({ origins: [pattern] })) held.add(pattern)
  }
  const next = forgetMissing(stored, held)
  if (next.length !== stored.length) await grantedOriginsItem.setValue(next)
  if (next.length > 0) await registerOptionalScripts(next)
  return next
}

/**
 * Deliver a command to the content script. On a page that has none, Alt+Y or the toolbar
 * can ask for that origin and inject the generic script. Explain and focus never prompt.
 */
export async function deliverCommand(
  tabId: number | undefined,
  url: string | undefined,
  command: ToggleCommand,
): Promise<void> {
  if (tabId == null) return
  try {
    await browser.tabs.sendMessage(tabId, { type: command } satisfies ToggleMessage)
    return
  } catch {
    // no content script on this tab
  }
  const plan = planSiteAccess(url)
  const stored = await grantedOriginsItem.getValue()
  const pattern = plan.kind === "optional" ? plan.pattern : ""
  const granted =
    pattern !== "" &&
    stored.includes(pattern) &&
    (await browser.permissions.contains({ origins: [pattern] }))
  const step = accessAction(plan, { command, scriptReached: false, granted })
  if (step === "request" && pattern) {
    let allowed = false
    try {
      allowed = await browser.permissions.request({ origins: [pattern] })
    } catch {
      allowed = false
    }
    if (!allowed) return
    const remembered = rememberOrigin(stored, pattern)
    await grantedOriginsItem.setValue(remembered)
    await registerOptionalScripts(remembered)
    await injectCourseScript(tabId)
    return
  }
  if (step === "inject" && pattern) {
    const patterns = stored.includes(pattern) ? stored : rememberOrigin(stored, pattern)
    if (!stored.includes(pattern)) await grantedOriginsItem.setValue(patterns)
    await registerOptionalScripts(patterns)
    await injectCourseScript(tabId)
  }
}
