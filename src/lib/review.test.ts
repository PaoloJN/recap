import { beforeEach, describe, expect, it } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import {
  countSummary,
  recordSummaryForReview,
  reviewItem,
  settleReview,
  shouldAskForReview,
} from "./review"

describe("review prompt state", () => {
  beforeEach(() => fakeBrowser.reset())

  it("asks after the third summary and not before", () => {
    let s = { summaries: 0, settled: false }
    expect(shouldAskForReview(s)).toBe(false)
    s = countSummary(s)
    s = countSummary(s)
    expect(shouldAskForReview(s)).toBe(false)
    s = countSummary(s)
    expect(shouldAskForReview(s)).toBe(true)
  })

  it("never asks again once settled", () => {
    const s = settleReview({ summaries: 3, settled: false })
    expect(shouldAskForReview(s)).toBe(false)
    expect(countSummary(s)).toEqual(s)
  })

  it("does not ask with no state yet", () => {
    expect(shouldAskForReview(undefined)).toBe(false)
  })

  it("records summaries in storage and stops at the threshold", async () => {
    for (let i = 0; i < 5; i++) await recordSummaryForReview()
    expect(await reviewItem.getValue()).toEqual({ summaries: 3, settled: false })
  })

  it("leaves a settled state alone", async () => {
    await reviewItem.setValue({ summaries: 1, settled: true })
    await recordSummaryForReview()
    expect(await reviewItem.getValue()).toEqual({ summaries: 1, settled: true })
  })
})
