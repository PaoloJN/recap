import { useCallback, useEffect, useSyncExternalStore } from "react"
import { browser } from "wxt/browser"
import type {
  ProLinkCancelRequest,
  ProLinkPollRequest,
  ProLinkPollResult,
  ProLinkReopenRequest,
  ProLinkStartRequest,
  ProLinkStartResult,
  ProRefreshRequest,
  ProSignOutRequest,
} from "@/lib/port-protocol"
import { PRO_ENABLED } from "@/lib/pro/config"
import type { MeResponse } from "@/lib/pro/types"
import { proItem } from "@/lib/storage"
import { useStorageItem } from "./useStorageItem"

/** Account data older than this is refetched on mount and when the tab becomes visible. */
export const PRO_STALE_MS = 5 * 60_000

const SIGN_IN_FAILED: ProLinkStartResult = { ok: false, message: "Couldn't sign in. Try again." }

const SIGNED_OUT = { token: null, me: null, fetchedAt: 0 }

export interface UsePro {
  enabled: boolean
  signedIn: boolean
  me: MeResponse | null
  /** A sign-in tab is open and the background is waiting for the website to approve it. */
  linkPending: boolean
  /** Opens the website's sign-in in a new tab; `returnUrl` is the video to come back to. */
  startSignIn(returnUrl: string | null): Promise<ProLinkStartResult>
  /**
   * One claim attempt; poll while `linkPending`. Null when a cancel or a new sign-in happened
   * while it was in flight: its answer no longer applies.
   */
  pollLink(): Promise<ProLinkPollResult | null>
  /**
   * One claim attempt while no sign-in is known to be pending here, to find a flow another page
   * started. Like `pollLink`, but an `error` says nothing about a flow and leaves `linkPending` off.
   */
  probeLink(): Promise<ProLinkPollResult | null>
  reopenSignIn(): Promise<void>
  cancelSignIn(): Promise<void>
  signOut(): Promise<void>
  refresh(): Promise<void>
}

// One refresh at a time per page, however many components use the hook.
let inflight: Promise<void> | null = null

function refreshNow(): Promise<void> {
  if (!PRO_ENABLED) return Promise.resolve()
  if (inflight) return inflight
  const request: ProRefreshRequest = { type: "pro-refresh" }
  inflight = (async () => {
    try {
      const { token } = await proItem.getValue()
      if (token === null) return
      // The background stores the result (or clears the token on 401); state arrives via watch.
      await browser.runtime.sendMessage(request)
    } catch {
      // Background unreachable: keep the snapshot we have and try again next time.
    } finally {
      inflight = null
    }
  })()
  return inflight
}

// Whether a sign-in link is pending, shared by every component on the page. The background owns
// the flow (in session storage, which content scripts can't read); this mirrors what its replies
// say.
let linkPending = false
const linkListeners = new Set<() => void>()

function setLinkPending(value: boolean): void {
  if (linkPending === value) return
  linkPending = value
  for (const listener of linkListeners) listener()
}

function subscribeLink(listener: () => void): () => void {
  linkListeners.add(listener)
  return () => linkListeners.delete(listener)
}

const getLinkPending = () => linkPending

// Bumped by every start and cancel, so a poll answered after either is ignored: a reply to the
// old flow must not bring a cancelled waiting state back.
let linkGeneration = 0

export function resetProLinkForTests(): void {
  linkGeneration++
  setLinkPending(false)
}

const STILL_PENDING = new Set<ProLinkPollResult["state"]>(["pending", "signed-in", "error"])

async function sendPoll(probe: boolean): Promise<ProLinkPollResult | null> {
  if (!PRO_ENABLED) return { state: "idle" }
  const generation = linkGeneration
  const request: ProLinkPollRequest = { type: "pro-link-poll" }
  let result: ProLinkPollResult = { state: "error" }
  try {
    result =
      ((await browser.runtime.sendMessage(request)) as ProLinkPollResult | undefined) ?? result
  } catch {
    // The worker may be restarting; the flow survives in its storage, so poll again later.
  }
  if (generation !== linkGeneration) return null
  if (probe && result.state === "error") return result
  setLinkPending(STILL_PENDING.has(result.state))
  return result
}

async function refreshIfStale(): Promise<void> {
  const { token, fetchedAt } = await proItem.getValue()
  if (token !== null && Date.now() - fetchedAt > PRO_STALE_MS) await refreshNow()
}

export function usePro(): UsePro {
  const [state] = useStorageItem(proItem)
  const pending = useSyncExternalStore(subscribeLink, getLinkPending, getLinkPending)

  useEffect(() => {
    if (!PRO_ENABLED) return
    void refreshIfStale()
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refreshIfStale()
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => document.removeEventListener("visibilitychange", onVisibility)
  }, [])

  const startSignIn = useCallback(async (returnUrl: string | null) => {
    if (!PRO_ENABLED) return SIGN_IN_FAILED
    const request: ProLinkStartRequest = { type: "pro-link-start", returnUrl }
    let result: ProLinkStartResult = SIGN_IN_FAILED
    try {
      result =
        ((await browser.runtime.sendMessage(request)) as ProLinkStartResult | undefined) ??
        SIGN_IN_FAILED
    } catch {
      // Background unreachable: nothing was opened.
    }
    if (result.ok) {
      linkGeneration++
      setLinkPending(true)
    }
    return result
  }, [])

  const pollLink = useCallback(() => sendPoll(false), [])
  const probeLink = useCallback(() => sendPoll(true), [])

  const reopenSignIn = useCallback(async (): Promise<void> => {
    if (!PRO_ENABLED) return
    const request: ProLinkReopenRequest = { type: "pro-link-reopen" }
    try {
      await browser.runtime.sendMessage(request)
    } catch {
      // Background unreachable: the user can still switch to the tab themselves.
    }
  }, [])

  const cancelSignIn = useCallback(async (): Promise<void> => {
    if (!PRO_ENABLED) return
    linkGeneration++
    setLinkPending(false)
    const request: ProLinkCancelRequest = { type: "pro-link-cancel" }
    try {
      await browser.runtime.sendMessage(request)
    } catch {
      // Background unreachable: the flow expires on its own.
    }
  }, [])

  const signOut = useCallback(async (): Promise<void> => {
    if (!PRO_ENABLED) return
    const request: ProSignOutRequest = { type: "pro-sign-out" }
    try {
      await browser.runtime.sendMessage(request)
    } catch {
      // Background unreachable: the server key can't be revoked now, but sign out locally anyway.
      try {
        await proItem.setValue(SIGNED_OUT)
      } catch (e) {
        console.error("Failed to clear Recap Pro session", e)
      }
    }
  }, [])

  const refresh = useCallback(() => refreshNow(), [])

  const signedIn = PRO_ENABLED && (state?.token ?? null) !== null
  return {
    enabled: PRO_ENABLED,
    signedIn,
    me: PRO_ENABLED ? (state?.me ?? null) : null,
    linkPending: PRO_ENABLED && pending,
    startSignIn,
    pollLink,
    probeLink,
    reopenSignIn,
    cancelSignIn,
    signOut,
    refresh,
  }
}
