import { browser } from "wxt/browser"
import type {
  ProAuthResult,
  ProRefreshResult,
  ProSignOutResult,
  RuntimeMessage,
} from "@/lib/port-protocol"
import { disconnect, fetchMe, ProError } from "@/lib/pro/api"
import { proUrl } from "@/lib/pro/config"
import type { MeResponse, ProState } from "@/lib/pro/types"
import { proItem } from "@/lib/storage"

const EMPTY: ProState = { token: null, me: null, fetchedAt: 0 }
const SIGN_IN_FAILED = "Couldn't sign in. Try again."
const NETWORK_MESSAGE = "Can't reach Recap Pro. Check your connection."
const SIGNED_OUT_MESSAGE = "You're not signed in to Recap Pro."
const CANCELLED = /cancel|did not approve|denied/i

export interface ProAuthDeps {
  store: { getValue(): Promise<ProState>; setValue(value: ProState): Promise<void> }
  fetchMe: (token: string) => Promise<MeResponse>
  disconnect: (token: string) => Promise<void>
  launchWebAuthFlow: (details: { url: string; interactive: boolean }) => Promise<string | undefined>
  getRedirectURL: (path: string) => string
  browser: "chrome" | "firefox"
  now: () => number
}

export function browserName(): "chrome" | "firefox" {
  return import.meta.env.BROWSER === "firefox" ? "firefox" : "chrome"
}

/** Reads the device key from `<redirect>#token=<key>`; null when missing, empty or undecodable. */
export function parseTokenFromRedirect(url: string | undefined): string | null {
  if (!url) return null
  const hash = url.indexOf("#")
  if (hash === -1) return null
  for (const pair of url.slice(hash + 1).split("&")) {
    const eq = pair.indexOf("=")
    if (eq === -1 || pair.slice(0, eq) !== "token") continue
    try {
      const token = decodeURIComponent(pair.slice(eq + 1))
      return token.trim() === "" ? null : token
    } catch {
      return null
    }
  }
  return null
}

function defaultDeps(): ProAuthDeps {
  return {
    store: proItem,
    fetchMe: (token) => fetchMe(token),
    disconnect: (token) => disconnect(token),
    launchWebAuthFlow: (details) => browser.identity.launchWebAuthFlow(details),
    getRedirectURL: (path) => browser.identity.getRedirectURL(path),
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

let signingIn: Promise<ProAuthResult> | null = null

/** True when `url` lands on exactly the expected redirect (same origin and path, no query). */
function isExpectedRedirect(url: string | undefined, expected: string): boolean {
  if (!url) return false
  try {
    const got = new URL(url)
    const want = new URL(expected)
    return got.origin === want.origin && got.pathname === want.pathname && got.search === ""
  } catch {
    return false
  }
}

async function runSignIn(deps: ProAuthDeps): Promise<ProAuthResult> {
  const expected = deps.getRedirectURL("connect")
  const url = proUrl(
    `/extension/connect?redirect_uri=${encodeURIComponent(expected)}&browser=${deps.browser}`,
  )
  let redirected: string | undefined
  try {
    redirected = await deps.launchWebAuthFlow({ url, interactive: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (CANCELLED.test(message))
      return { ok: false, reason: "cancelled", message: "Sign-in cancelled." }
    return { ok: false, reason: "failed", message: SIGN_IN_FAILED }
  }
  const token = isExpectedRedirect(redirected, expected) ? parseTokenFromRedirect(redirected) : null
  if (!token) return { ok: false, reason: "failed", message: SIGN_IN_FAILED }
  await deps.store.setValue({ token, me: null, fetchedAt: 0 })
  const result = await refresh(deps)
  // Any failure but 401 still leaves a valid token; `me` loads on the next refresh.
  if (!result.ok && result.code === "unauthorized") {
    return { ok: false, reason: "failed", message: SIGN_IN_FAILED }
  }
  return { ok: true }
}

/** Opens the Recap Pro connect window. A second call while one is open returns the same promise. */
export function signIn(deps: ProAuthDeps): Promise<ProAuthResult> {
  if (signingIn) return signingIn
  const pending = runSignIn(deps).finally(() => {
    if (signingIn === pending) signingIn = null
  })
  signingIn = pending
  return pending
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

type ProMessage = Extract<RuntimeMessage, { type: "pro-sign-in" | "pro-sign-out" | "pro-refresh" }>

function isProMessage(message: unknown): message is ProMessage {
  const type = (message as { type?: unknown } | null)?.type
  return type === "pro-sign-in" || type === "pro-sign-out" || type === "pro-refresh"
}

function handle(message: ProMessage, deps: ProAuthDeps): Promise<unknown> {
  switch (message.type) {
    case "pro-sign-in":
      return signIn(deps).catch(
        (): ProAuthResult => ({ ok: false, reason: "failed", message: SIGN_IN_FAILED }),
      )
    case "pro-sign-out":
      return signOut(deps).catch((): ProSignOutResult => ({ ok: true }))
    case "pro-refresh":
      return refresh(deps).catch(
        (): ProRefreshResult => ({ ok: false, code: "network", message: NETWORK_MESSAGE }),
      )
  }
}

/** Wires the Pro auth messages. Call only in a Pro build (needs the `identity` permission). */
export function registerProHandlers(deps?: ProAuthDeps): void {
  let resolved = deps
  browser.runtime.onMessage.addListener(
    (message: unknown, _sender: unknown, sendResponse: (r: unknown) => void) => {
      if (!isProMessage(message)) return undefined
      resolved ??= defaultDeps()
      // Chrome ignores a returned Promise: answer through sendResponse and keep the channel open.
      handle(message, resolved)
        .then(sendResponse)
        .catch(() => {})
      return true
    },
  )
}
