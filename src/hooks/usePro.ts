import { useCallback, useEffect, useState } from "react"
import { browser } from "wxt/browser"
import type {
  ProAuthResult,
  ProRefreshRequest,
  ProSignInRequest,
  ProSignOutRequest,
} from "@/lib/port-protocol"
import { fetchPricing } from "@/lib/pro/api"
import { PRO_ENABLED } from "@/lib/pro/config"
import type { MeResponse, Pricing } from "@/lib/pro/types"
import { proItem } from "@/lib/storage"
import { useStorageItem } from "./useStorageItem"

/** Account data older than this is refetched on mount and when the tab becomes visible. */
export const PRO_STALE_MS = 5 * 60_000

const SIGN_IN_FAILED: ProAuthResult = {
  ok: false,
  reason: "failed",
  message: "Couldn't sign in. Try again.",
}

const SIGNED_OUT = { token: null, me: null, fetchedAt: 0 }

export interface UsePro {
  enabled: boolean
  signedIn: boolean
  me: MeResponse | null
  signingIn: boolean
  signIn(): Promise<ProAuthResult>
  signOut(): Promise<void>
  refresh(): Promise<void>
  pricing: Pricing | null
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

// Pricing is public and changes rarely: one request per page load, shared by every hook.
// A failed request is not cached, so the next mount tries again.
let pricingCache: Pricing | null = null
let pricingRequest: Promise<Pricing> | null = null

function loadPricing(): Promise<Pricing> {
  if (pricingRequest) return pricingRequest
  const request = fetchPricing().then(
    (p) => {
      pricingCache = p
      return p
    },
    (e: unknown) => {
      pricingRequest = null
      throw e
    },
  )
  pricingRequest = request
  return request
}

/** Test hook: forget the cached pricing. */
export function resetPricingCacheForTests(): void {
  pricingCache = null
  pricingRequest = null
}

async function refreshIfStale(): Promise<void> {
  const { token, fetchedAt } = await proItem.getValue()
  if (token !== null && Date.now() - fetchedAt > PRO_STALE_MS) await refreshNow()
}

export function usePro(): UsePro {
  const [state] = useStorageItem(proItem)
  const [signingIn, setSigningIn] = useState(false)
  const [pricing, setPricing] = useState<Pricing | null>(() => (PRO_ENABLED ? pricingCache : null))

  useEffect(() => {
    if (!PRO_ENABLED) return
    void refreshIfStale()
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refreshIfStale()
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => document.removeEventListener("visibilitychange", onVisibility)
  }, [])

  useEffect(() => {
    if (!PRO_ENABLED) return
    let active = true
    loadPricing().then(
      (p) => {
        if (active) setPricing(p)
      },
      () => {},
    )
    return () => {
      active = false
    }
  }, [])

  const signIn = useCallback(async (): Promise<ProAuthResult> => {
    if (!PRO_ENABLED) return SIGN_IN_FAILED
    setSigningIn(true)
    try {
      const request: ProSignInRequest = { type: "pro-sign-in" }
      let result: ProAuthResult = SIGN_IN_FAILED
      try {
        result =
          ((await browser.runtime.sendMessage(request)) as ProAuthResult | undefined) ??
          SIGN_IN_FAILED
      } catch {
        // The MV3 worker can restart mid sign-in and drop the reply; the token may still be stored.
      }
      if (!result.ok && (await proItem.getValue()).token !== null) return { ok: true }
      return result
    } catch {
      return SIGN_IN_FAILED
    } finally {
      setSigningIn(false)
    }
  }, [])

  const signOut = useCallback(async (): Promise<void> => {
    if (!PRO_ENABLED) return
    const request: ProSignOutRequest = { type: "pro-sign-out" }
    try {
      await browser.runtime.sendMessage(request)
    } catch {
      // Background unreachable: the server key can't be revoked now, but sign out locally anyway.
      await proItem.setValue(SIGNED_OUT)
    }
  }, [])

  const refresh = useCallback(() => refreshNow(), [])

  const signedIn = PRO_ENABLED && (state?.token ?? null) !== null
  return {
    enabled: PRO_ENABLED,
    signedIn,
    me: PRO_ENABLED ? (state?.me ?? null) : null,
    signingIn,
    signIn,
    signOut,
    refresh,
    pricing,
  }
}
