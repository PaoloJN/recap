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
/** How long a link lives on the server; measured locally so a wrong device clock can't skew it. */
export const LINK_TTL_MS = 30 * 60_000

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
    deadline: deps.now() + LINK_TTL_MS,
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

/**
 * Returns to the video and closes the sign-in tab, then clears the flow. The sign-in tab is
 * closed only once the video tab is in front: if the video tab is gone, the website opens the
 * video in the sign-in tab itself, so that tab stays.
 */
async function finish(deps: ProAuthDeps, link: ProLink): Promise<ProLinkPollResult> {
  let backOnVideo = false
  if (link.sourceTabId !== null) {
    try {
      await focusTab(deps, link.sourceTabId)
      backOnVideo = true
    } catch {
      // The video tab is gone.
    }
  }
  if (backOnVideo && link.signInTabId !== null) {
    try {
      await deps.tabs.remove(link.signInTabId)
    } catch {
      // Already closed.
    }
  }
  await updateLink(deps, link.code, null)
  return { state: "done" }
}

/**
 * Moves a claimed key from the flow into `proItem`, then drops it from the flow. Idempotent, so a
 * worker that died part-way just runs it again on the next poll. Returns the updated flow.
 */
async function storeKey(deps: ProAuthDeps, link: ProLink & { key: string }): Promise<ProLink> {
  const { key, ...delivered } = link
  if ((await deps.store.getValue()).token !== key) {
    await deps.store.setValue({ token: key, me: null, fetchedAt: 0 })
  }
  await updateLink(deps, link.code, delivered)
  return delivered
}

/**
 * Loads `me` for a freshly stored key. False (flow cleared) when the server rejects the key; any
 * other failure still leaves a valid key, and `me` loads on the next refresh.
 */
async function checkKey(deps: ProAuthDeps, code: string): Promise<boolean> {
  const result = await refresh(deps)
  if (!result.ok && result.code === "unauthorized") {
    await updateLink(deps, code, null)
    return false
  }
  return true
}

/** Stores a key still held in the flow and loads `me`; null when the server rejects the key. */
async function deliverKey(
  deps: ProAuthDeps,
  link: ProLink & { key: string },
): Promise<ProLink | null> {
  const delivered = await storeKey(deps, link)
  return (await checkKey(deps, link.code)) ? delivered : null
}

/** After a claim of ours: hands over a key still held in the flow, then finishes or waits. */
async function afterClaim(
  deps: ProAuthDeps,
  link: ProLink,
  finished: boolean,
): Promise<ProLinkPollResult> {
  if (link.key === undefined) return finished ? finish(deps, link) : { state: "signed-in" }
  const delivered = await storeKey(deps, { ...link, key: link.key })
  if (finished) {
    // Back to the video first: the website sends the sign-in tab to the video after 2 s, and a
    // `me` round trip before closing it would often lose that race.
    const done = await finish(deps, delivered)
    return (await checkKey(deps, link.code)) ? done : { state: "error" }
  }
  return (await checkKey(deps, link.code)) ? { state: "signed-in" } : { state: "error" }
}

/**
 * Ends a flow the clock or the server expired. Once this browser holds the key the user is signed
 * in, and only checkout was left unfinished, so the flow just ends quietly.
 */
async function endExpired(deps: ProAuthDeps, link: ProLink): Promise<ProLinkPollResult> {
  await updateLink(deps, link.code, null)
  return link.claimed ? { state: "idle" } : { state: "expired" }
}

async function runPoll(deps: ProAuthDeps): Promise<ProLinkPollResult> {
  let link = await deps.link.getValue()
  if (!link) return { state: "idle" }
  // A worker that died after the claim left the key in the flow: deliver it before anything else
  // (expiry included), so a successful claim is never lost.
  if (link.key !== undefined) {
    const delivered = await deliverKey(deps, { ...link, key: link.key })
    if (!delivered) return { state: "error" }
    link = delivered
  }
  // A claimed flow keeps polling only so the sign-in tab can close on "finished"; the deadline
  // ends it too, so an abandoned checkout doesn't poll forever.
  if (!(link.deadline > deps.now())) return endExpired(deps, link)
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
      return endExpired(deps, link)
    case "approved": {
      // Crash-safe order: one write records `claimed` together with the key, before the key goes
      // anywhere else. If the worker dies after it, the next poll finds the key in the flow and
      // delivers it (the server then answers `claimed`, which we now recognise as ours). Saving
      // the key to `proItem` first would leave a window where a restart sees `claimed` without
      // a local claim and reports `error` for a successful sign-in.
      const held: ProLink = { ...link, claimed: true, key: claim.key }
      await updateLink(deps, link.code, held)
      return afterClaim(deps, held, claim.finished)
    }
    case "claimed":
      // Claimed, but not by us: nothing left to hand over.
      if (!link.claimed) {
        await updateLink(deps, link.code, null)
        return { state: "error" }
      }
      return afterClaim(deps, link, claim.finished)
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
