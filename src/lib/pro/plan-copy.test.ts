import { describe, expect, it } from "vitest"
import { planLine, trialPriceLine, usageLine } from "./plan-copy"
import type { MeResponse } from "./types"

const NOW = Date.parse("2026-10-27T12:00:00Z")

function me(overrides: Partial<MeResponse> = {}): MeResponse {
  return {
    user: { email: "a@b.c", name: "A", image: null },
    plan: "trial",
    usage: { summaries: 8, chats: 10, summaryLimit: 20, chatLimit: 50, resetsAt: null },
    subscription: null,
    ...overrides,
  }
}

const proUsage = {
  summaries: 12,
  chats: 40,
  summaryLimit: 300,
  chatLimit: 1000,
  resetsAt: "2026-11-01T00:00:00Z",
}

function pro(subscription: MeResponse["subscription"]): MeResponse {
  return me({ plan: "pro", usage: proUsage, subscription })
}

describe("planLine", () => {
  it("shows what is left of the trial", () => {
    expect(planLine(me(), NOW)).toBe("Trial · 12 of 20 summaries, 40 of 50 messages left")
  })
  it("never shows a negative remainder", () => {
    const used = me({
      usage: { summaries: 25, chats: 50, summaryLimit: 20, chatLimit: 50, resetsAt: null },
    })
    expect(planLine(used, NOW)).toBe("Trial · 0 of 20 summaries, 0 of 50 messages left")
  })
  it("shows the renewal date for Pro", () => {
    const m = pro({
      status: "active",
      currentPeriodEnd: "2026-11-27T10:00:00Z",
      cancelAtPeriodEnd: false,
    })
    expect(planLine(m, NOW)).toBe("Pro · renews Nov 27")
  })
  it("shows the end date when Pro is cancelled at period end", () => {
    const m = pro({
      status: "active",
      currentPeriodEnd: "2026-11-27T10:00:00Z",
      cancelAtPeriodEnd: true,
    })
    expect(planLine(m, NOW)).toBe("Pro · ends Nov 27")
  })
  it("formats the date in UTC", () => {
    const m = pro({
      status: "active",
      currentPeriodEnd: "2026-11-27T23:30:00Z",
      cancelAtPeriodEnd: false,
    })
    expect(planLine(m, NOW)).toBe("Pro · renews Nov 27")
  })
  it("is plain Pro without a period end", () => {
    expect(
      planLine(pro({ status: "active", currentPeriodEnd: null, cancelAtPeriodEnd: false }), NOW),
    ).toBe("Pro")
    expect(planLine(pro(null), NOW)).toBe("Pro")
  })
  it("is plain Pro when the period end is already past", () => {
    const m = pro({
      status: "active",
      currentPeriodEnd: "2026-10-01T00:00:00Z",
      cancelAtPeriodEnd: false,
    })
    expect(planLine(m, NOW)).toBe("Pro")
  })
  it("is plain Pro when the period end is not a valid date", () => {
    const m = pro({ status: "active", currentPeriodEnd: "garbage", cancelAtPeriodEnd: false })
    expect(planLine(m, NOW)).toBe("Pro")
  })
  it("says the trial ended when expired", () => {
    expect(planLine(me({ plan: "expired" }), NOW)).toBe("Trial ended")
  })
})

describe("usageLine", () => {
  it("shows Pro usage with thousands separators and the reset date", () => {
    expect(usageLine(pro(null), NOW)).toBe(
      "12 of 300 summaries · 40 of 1,000 messages · resets Nov 1",
    )
  })
  it("omits the reset date when there is none", () => {
    const m = me({ plan: "pro", usage: { ...proUsage, resetsAt: null } })
    expect(usageLine(m, NOW)).toBe("12 of 300 summaries · 40 of 1,000 messages")
  })
  it("omits a reset date that is already past", () => {
    const m = me({ plan: "pro", usage: { ...proUsage, resetsAt: "2026-10-01T00:00:00Z" } })
    expect(usageLine(m, NOW)).toBe("12 of 300 summaries · 40 of 1,000 messages")
  })
  it("omits an invalid reset date", () => {
    const m = me({ plan: "pro", usage: { ...proUsage, resetsAt: "not a date" } })
    expect(usageLine(m, NOW)).toBe("12 of 300 summaries · 40 of 1,000 messages")
  })
  it("shows trial usage", () => {
    const m = me({
      usage: { summaries: 12, chats: 40, summaryLimit: 20, chatLimit: 50, resetsAt: null },
    })
    expect(usageLine(m, NOW)).toBe("12 of 20 summaries · 40 of 50 messages")
  })
})

describe("trialPriceLine", () => {
  it("names the monthly price", () => {
    expect(trialPriceLine({ monthly: { display: "$4.99" }, yearly: { display: "$39.99" } })).toBe(
      "20 free summaries. Then $4.99/month, cancel anytime.",
    )
  })
  it("falls back when pricing is unknown", () => {
    expect(trialPriceLine(null)).toBe(
      "20 free summaries. Then a small monthly plan, cancel anytime.",
    )
  })
})
