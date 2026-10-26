import { describe, expect, it } from "vitest"
import { formatTokens, resetsLabel, usageSummaryLine } from "./usage-format"

describe("formatTokens", () => {
  it.each([
    [0, "0"],
    [412, "412"],
    [999, "999"],
    [1234, "1.2k"],
    [41_200, "41k"],
    [412_000, "412k"],
    [999_999, "1M"],
    [1_250_000, "1.3M"],
    [12_400_000, "12M"],
  ])("%d → %s", (n, expected) => {
    expect(formatTokens(n)).toBe(expected)
  })
})

describe("usageSummaryLine", () => {
  it("joins tokens, summaries and chats", () => {
    expect(usageSummaryLine({ tokens: 412_000, summaries: 38, chats: 61 })).toBe(
      "412k tokens · 38 summaries · 61 chats",
    )
  })

  it("uses the singular for one", () => {
    expect(usageSummaryLine({ tokens: 0, summaries: 1, chats: 1 })).toBe(
      "0 tokens · 1 summary · 1 chat",
    )
  })
})

describe("resetsLabel", () => {
  it("names the first of next month", () => {
    expect(resetsLabel(new Date(2026, 9, 26))).toBe("Resets Nov 1")
  })

  it("wraps December to January", () => {
    expect(resetsLabel(new Date(2026, 11, 3))).toBe("Resets Jan 1")
  })
})
