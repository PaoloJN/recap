import { describe, expect, it } from "vitest"
import { estimateLabel, parseSummary, summaryForCopy } from "./parse"

const FULL = `Partial prerendering splits a page.\n\n## Key moments\n- 0:14 Static vs dynamic\n- 1:48 No new API\n\n## Notes\n- Works with existing code.\n\n## In plain terms\nMost of a page never changes.\n\n## Questions\n- What is a Suspense boundary?\n- Is it production-ready?\n- How is it different from ISR?\n`

describe("parseSummary", () => {
  it("parses every section", () =>
    expect(parseSummary(FULL)).toEqual({
      lead: "Partial prerendering splits a page.",
      moments: [
        { seconds: 14, text: "Static vs dynamic" },
        { seconds: 108, text: "No new API" },
      ],
      notes: ["Works with existing code."],
      plain: "Most of a page never changes.",
      questions: [
        "What is a Suspense boundary?",
        "Is it production-ready?",
        "How is it different from ISR?",
      ],
    }))

  it("tolerates bold and bracketed timestamps and a heading cut mid-stream", () => {
    const p = parseSummary("Lead.\n\n## Key moments\n- **0:14** A\n- [1:02:03] B\n\n## Not")
    expect(p.moments).toEqual([
      { seconds: 14, text: "A" },
      { seconds: 3723, text: "B" },
    ])
    expect(p.notes).toEqual([])
  })

  it("drops a partial heading from the lead", () => {
    expect(parseSummary("Lead.\n\n## Key mo").lead).toBe("Lead.")
  })

  it("puts unknown headings into lead and never throws on garbage", () => {
    expect(parseSummary("## Overview\nHi\n\n## Key moments\n- nope").lead).toContain("Hi")
    expect(() => parseSummary("###\n-\n- :")).not.toThrow()
  })

  it("matches headings case-insensitively and strips other bullet markers", () => {
    const p = parseSummary("## NOTES\n* one\n• two\n\n## questions\n- q?")
    expect(p.notes).toEqual(["one", "two"])
    expect(p.questions).toEqual(["q?"])
  })

  it("ignores moment bullets without a timestamp", () => {
    expect(parseSummary("## Key moments\n- nope\n- 2:00: Real").moments).toEqual([
      { seconds: 120, text: "Real" },
    ])
  })

  it("collapses blank lines in the lead", () => {
    expect(parseSummary("A.\n\n\n\nB.").lead).toBe("A.\n\nB.")
  })
})

describe("summaryForCopy", () => {
  it("strips the Questions section", () => {
    const out = summaryForCopy(FULL)
    expect(out).not.toContain("## Questions")
    expect(out).not.toContain("Suspense")
    expect(out).toContain("## In plain terms")
  })
})

describe("estimateLabel", () => {
  it("thresholds", () => {
    expect(estimateLabel(100)).toBe("5s")
    expect(estimateLabel(20_000)).toBe("10s")
    expect(estimateLabel(60_000)).toBe("20s")
  })
})
