import { browser } from "wxt/browser"
import type {
  ProLinkCancelResult,
  ProLinkPollResult,
  ProLinkReopenResult,
  ProLinkStartResult,
  ProRefreshResult,
  ProSignOutResult,
  RuntimeMessage,
} from "@/lib/port-protocol"
import { claimLink, disconnect, fetchMe, ProError, startLink } from "@/lib/pro/api"
import { proUrl } from "@/lib/pro/config"
import { createPkce } from "@/lib/pro/pkce"
import type { LinkClaim, LinkStart, MeResponse, ProLink, ProState } from "@/lib/pro/types"
import { proItem, proLinkItem } from "@/lib/storage"

const EMPTY: ProState = { token: null, me: null, fetchedAt: 0 }
const SIGN_IN_FAILED = "Couldn't sign in. Try again."
const NETWORK_MESSAGE = "Can't reach Recap Pro. Check your connection."
const SIGNED_OUT_MESSAGE = "You're not signed in to Recap Pro."

/** The few tab and window calls sign-in needs; none of them needs a permission. */
export interface TabsApi {
  create(props: { url: string; active: boolean }): Promise<{ id?: number }>
  update(tabId: number, props: { active: boolean }): Promise<{ windowId?: number } | undefined>
  remove(tabId: number): Promise<void>
}

export interface ProAuthDeps {
  store: { getValue(): Promise<ProState>; setValue(value: ProState): Promise<void> }
  link: { getValue(): Promise<ProLink | null>; setValue(value: ProLink | null): Promise<void> }
  fetchMe: (token: string) => Promise<MeResponse>
  disconnect: (token: string) => Promise<void>
  startLink: (challenge: string, browser: "chrome" | "firefox") => Promise<LinkStart>
  claimLink: (code: string, verifier: string) => Promise<LinkClaim>
  createPkce: () => Promise<{ verifier: string; challenge: string }>
  tabs: TabsApi
  windows: { update(windowId: number, props: { focused: boolean }): Promise<unknown> }
  browser: "chrome" | "firefox"
  now: () => number
}

export function browserName(): "chrome" | "firefox" {
  return import.meta.env.BROWSER === "firefox" ? "firefox" : "chrome"
}

function defaultDeps(): ProAuthDeps {
  return {
    store: proItem,
    link: proLinkItem,
    fetchMe: (token) => fetchMe(token),
    disconnect: (token) => disconnect(token),
    startLink: (challenge, name) => startLink(challenge, name),
    claimLink: (code, verifier) => claimLink(code, verifier),
    createPkce,
    tabs: {
      create: (props) => browser.tabs.create(props),
      update: (tabId, props) => browser.tabs.update(tabId, props),
      remove: (tabId) => browser.tabs.remove(tabId),
    },
    windows: { update: (windowId, props) => browser.windows.update(windowId, props) },
    browser: browserName(),
    now: Date.now,
  }
}

/** Fetches `me` with the stored token. 401 signs out; other failures leave state untouched. */
export async function refresh(deps: ProAuthDeps): Promise<ProRefreshResult> {
  const { token } = await deps.store.getValue()
  if (!token) return { ok: false, code: "unauthorized", message: SIGNED_OUT_MESSAGE }
  try {
    const me = await deps.fetchMe(token)
    const current = await deps.store.getValue()
    // Signed out (or re-signed in) while the request was in flight: don't write stale data.
    if (current.token === token) await deps.store.setValue({ token, me, fetchedAt: deps.now() })
    return { ok: true, me }
  } catch (error) {
    if (!(error instanceof ProError)) {
      return { ok: false, code: "network", message: NETWORK_MESSAGE }
    }
    if (error.code === "unauthorized") {
      const current = await deps.store.getValue()
      if (current.token === token) await deps.store.setValue(EMPTY)
    }
    return { ok: false, code: error.code, message: error.message }
  }
}

/** Starts a sign-in: makes a link, opens the website in a new tab and remembers the flow. */
export async function startSignIn(
  deps: ProAuthDeps,
  returnUrl: string | null,
  sourceTabId: number | null,
): Promise<ProLinkStartResult> {
  const { verifier, challenge } = await deps.createPkce()
  let started: LinkStart
  try {
    started = await deps.startLink(challenge, deps.browser)
  } catch (error) {
    const network = error instanceof ProError && error.code === "network"
    return { ok: false, message: network ? NETWORK_MESSAGE : SIGN_IN_FAILED }
  }
  const back = returnUrl ? `&return=${encodeURIComponent(returnUrl)}` : ""
  const signInUrl = proUrl(`/sign-in?link=${encodeURIComponent(started.code)}${back}`)
  let signInTabId: number | null
  try {
    signInTabId = (await deps.tabs.create({ url: signInUrl, active: true })).id ?? null
  } catch {
    return { ok: false, message: SIGN_IN_FAILED }
  }
  // Replaces any flow already pending: only the newest sign-in tab can hand over a key.
  await deps.link.setValue({
    code: started.code,
    verifier,
    signInUrl,
    signInTabId,
    sourceTabId,
    expiresAt: started.expiresAt,
    claimed: false,
  })
  return { ok: true }
}

/** Writes to the flow only while it is still the one identified by `code`. */
async function updateLink(deps: ProAuthDeps, code: string, next: ProLink | null): Promise<void> {
  const current = await deps.link.getValue()
  if (current?.code === code) await deps.link.setValue(next)
}

/** Brings a tab and its window to the front; throws when the tab is gone. */
async function focusTab(deps: ProAuthDeps, tabId: number): Promise<void> {
  const tab = await deps.tabs.update(tabId, { active: true })
  if (tab?.windowId == null) return
  try {
    await deps.windows.update(tab.windowId, { focused: true })
  } catch {
    // The tab is in front of its window; a window we can't focus is fine.
  }
}

/** Closes the sign-in tab and returns to the video, ignoring tabs that are already gone. */
async function finish(deps: ProAuthDeps, link: ProLink): Promise<ProLinkPollResult> {
  if (link.signInTabId !== null) {
    try {
      await deps.tabs.remove(link.signInTabId)
    } catch {
      // Already closed.
    }
  }
  if (link.sourceTabId !== null) {
    try {
      await focusTab(deps, link.sourceTabId)
    } catch {
      // The video tab is gone; the website opens the video itself.
    }
  }
  await updateLink(deps, link.code, null)
  return { state: "done" }
}

async function runPoll(deps: ProAuthDeps): Promise<ProLinkPollResult> {
  const link = await deps.link.getValue()
  if (!link) return { state: "idle" }
  if (!(Date.parse(link.expiresAt) > deps.now())) {
    await updateLink(deps, link.code, null)
    return { state: "expired" }
  }
  let claim: LinkClaim
  try {
    claim = await deps.claimLink(link.code, link.verifier)
  } catch (error) {
    // The server refused this code or verifier: it never will accept them, so drop the flow.
    if (error instanceof ProError && error.code === "bad_request") {
      await updateLink(deps, link.code, null)
    }
    return { state: "error" }
  }
  switch (claim.status) {
    case "pending":
      return { state: "pending" }
    case "expired":
      await updateLink(deps, link.code, null)
      return { state: "expired" }
    case "approved": {
      await deps.store.setValue({ token: claim.key, me: null, fetchedAt: 0 })
      const claimed = { ...link, claimed: true }
      await updateLink(deps, link.code, claimed)
      const result = await refresh(deps)
      // Any failure but 401 still leaves a valid key; `me` loads on the next refresh.
      if (!result.ok && result.code === "unauthorized") {
        await updateLink(deps, link.code, null)
        return { state: "error" }
      }
      return claim.finished ? finish(deps, claimed) : { state: "signed-in" }
    }
    case "claimed":
      // Claimed, but not by us (or we lost the key before saving it): nothing left to hand over.
      if (!link.claimed) {
        await updateLink(deps, link.code, null)
        return { state: "error" }
      }
      return claim.finished ? finish(deps, link) : { state: "signed-in" }
  }
}

let polling: Promise<ProLinkPollResult> | null = null

/**
 * One claim for the pending sign-in. Overlapping polls (several panels, a slow server) share
 * one claim, so the key returned exactly once is never raced.
 */
export function pollLink(deps: ProAuthDeps): Promise<ProLinkPollResult> {
  if (polling) return polling
  const pending = runPoll(deps).finally(() => {
    if (polling === pending) polling = null
  })
  polling = pending
  return pending
}

/** Brings the sign-in tab back, or reopens its URL when the user closed it. */
export async function reopenSignIn(deps: ProAuthDeps): Promise<ProLinkReopenResult> {
  const link = await deps.link.getValue()
  if (!link) return { ok: false }
  if (link.signInTabId !== null) {
    try {
      await focusTab(deps, link.signInTabId)
      return { ok: true }
    } catch {
      // Closed: open it again below.
    }
  }
  const tab = await deps.tabs.create({ url: link.signInUrl, active: true })
  await updateLink(deps, link.code, { ...link, signInTabId: tab.id ?? null })
  return { ok: true }
}

/** Forgets the pending sign-in; the website tab stays open but can no longer hand over a key. */
export async function cancelSignIn(deps: ProAuthDeps): Promise<ProLinkCancelResult> {
  await deps.link.setValue(null)
  return { ok: true }
}

/** Revokes the device key (best effort) and forgets it locally. */
export async function signOut(deps: ProAuthDeps): Promise<ProSignOutResult> {
  const { token } = await deps.store.getValue()
  if (token) {
    try {
      await deps.disconnect(token)
    } catch {
      // Local sign-out must succeed even when the server can't be reached.
    }
  }
  // A sign-in that completed while disconnect was in flight keeps its new token.
  const current = await deps.store.getValue()
  if (current.token === token) await deps.store.setValue(EMPTY)
  return { ok: true }
}

const PRO_MESSAGES = [
  "pro-link-start",
  "pro-link-poll",
  "pro-link-reopen",
  "pro-link-cancel",
  "pro-sign-out",
  "pro-refresh",
] as const

type ProMessage = Extract<RuntimeMessage, { type: (typeof PRO_MESSAGES)[number] }>

function isProMessage(message: unknown): message is ProMessage {
  const type = (message as { type?: unknown } | null)?.type
  return PRO_MESSAGES.includes(type as ProMessage["type"])
}

function handle(message: ProMessage, deps: ProAuthDeps, sourceTabId: number | null) {
  switch (message.type) {
    case "pro-link-start": {
      const returnUrl = typeof message.returnUrl === "string" ? message.returnUrl : null
      return startSignIn(deps, returnUrl, sourceTabId).catch(
        (): ProLinkStartResult => ({ ok: false, message: SIGN_IN_FAILED }),
      )
    }
    case "pro-link-poll":
      return pollLink(deps).catch((): ProLinkPollResult => ({ state: "error" }))
    case "pro-link-reopen":
      return reopenSignIn(deps).catch((): ProLinkReopenResult => ({ ok: false }))
    case "pro-link-cancel":
      return cancelSignIn(deps).catch((): ProLinkCancelResult => ({ ok: true }))
    case "pro-sign-out":
      return signOut(deps).catch((): ProSignOutResult => ({ ok: true }))
    case "pro-refresh":
      return refresh(deps).catch(
        (): ProRefreshResult => ({ ok: false, code: "network", message: NETWORK_MESSAGE }),
      )
  }
}

/** Wires the Pro auth messages. Call only in a Pro build. */
export function registerProHandlers(deps?: ProAuthDeps): void {
  let resolved = deps
  browser.runtime.onMessage.addListener(
    (
      message: unknown,
      sender: { tab?: { id?: number } } | undefined,
      sendResponse: (r: unknown) => void,
    ) => {
      if (!isProMessage(message)) return undefined
      resolved ??= defaultDeps()
      // Chrome ignores a returned Promise: answer through sendResponse and keep the channel open.
      Promise.resolve(handle(message, resolved, sender?.tab?.id ?? null))
        .then(sendResponse)
        .catch(() => {})
      return true
    },
  )
}
