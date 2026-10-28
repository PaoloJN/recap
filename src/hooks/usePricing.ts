import { useEffect, useState } from "react"
import { fetchPricing } from "@/lib/pro/api"
import { PRO_ENABLED } from "@/lib/pro/config"
import type { Pricing } from "@/lib/pro/types"

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

/**
 * Recap Pro prices, fetched from the Pro server. Only components that show a price use this
 * (the sign-in and upgrade gates), so someone using their own key never contacts the Pro origin.
 * Null until loaded, on failure, and in builds without Recap Pro.
 */
export function usePricing(): Pricing | null {
  const [pricing, setPricing] = useState<Pricing | null>(() => (PRO_ENABLED ? pricingCache : null))

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

  return pricing
}
