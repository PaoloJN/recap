import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Pricing } from "@/lib/pro/types"
import { resetPricingCacheForTests, usePricing } from "./usePricing"

const cfg = vi.hoisted(() => ({ enabled: true }))
const api = vi.hoisted(() => ({ fetchPricing: vi.fn() }))

vi.mock("@/lib/pro/config", () => ({
  get PRO_ENABLED() {
    return cfg.enabled
  },
  PRO_ORIGIN: "https://recap.test",
  proUrl: (path: string) => `https://recap.test${path}`,
}))
vi.mock("@/lib/pro/api", () => ({ fetchPricing: api.fetchPricing }))

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

const PRICING: Pricing = { monthly: { display: "$4.99" }, yearly: { display: "$39.99" } }

let pricing: Pricing | null = null
let root: Root | null = null

function Probe() {
  pricing = usePricing()
  return null
}

async function mount() {
  root = createRoot(document.createElement("div"))
  await act(async () => root?.render(<Probe />))
  await act(async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve()
  })
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  cfg.enabled = true
  api.fetchPricing.mockReset()
  api.fetchPricing.mockResolvedValue(PRICING)
  resetPricingCacheForTests()
  pricing = null
})

afterEach(() => {
  act(() => root?.unmount())
  root = null
})

describe("usePricing", () => {
  it("loads pricing once per page, shared across mounts", async () => {
    await mount()
    expect(pricing).toEqual(PRICING)
    expect(api.fetchPricing).toHaveBeenCalledTimes(1)

    act(() => root?.unmount())
    await mount()
    expect(pricing).toEqual(PRICING)
    expect(api.fetchPricing).toHaveBeenCalledTimes(1)
  })

  it("keeps null on failure and retries on the next mount", async () => {
    api.fetchPricing.mockRejectedValueOnce(new Error("offline"))
    await mount()
    expect(pricing).toBeNull()

    act(() => root?.unmount())
    await mount()
    expect(pricing).toEqual(PRICING)
    expect(api.fetchPricing).toHaveBeenCalledTimes(2)
  })

  it("is inert in a build without Recap Pro", async () => {
    cfg.enabled = false
    await mount()
    expect(pricing).toBeNull()
    expect(api.fetchPricing).not.toHaveBeenCalled()
  })
})
