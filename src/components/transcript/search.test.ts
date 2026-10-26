import { describe, expect, it } from "vitest"
import { displayText } from "@/lib/transcript/text"
import { searchMatches, wrapIndex } from "./search"

// The prototype transcript (docs/design/v3-handoff/prototype/extracted/logic.js `TRANSCRIPT`).
const TRANSCRIPT = [
  "Partial prerendering is a new rendering model we've been working on in Next.js.",
  "So, um, the idea is simple. You shouldn't have to pick static or dynamic for a whole route.",
  "Most pages are mostly static. A header, a product description, some layout.",
  "But there's usually a small part that's, you know, personal. A cart, recommendations, a signed-in state.",
  "Today, that one dynamic piece forces the whole page to render on every request.",
  "With partial prerendering, we prerender a static shell at build time and serve it from the edge.",
  "The dynamic parts stream in afterward, in the same HTTP request.",
  "And, uh, there's no new API. You wrap the dynamic part in a Suspense boundary.",
  "The fallback you pass to Suspense becomes part of the static shell.",
  "Let's look at a demo. Here's an e-commerce page with a product and a cart.",
  "Notice the product info loads instantly. The cart streams in a moment later.",
  "That's the point. Fast initial load, and still fully dynamic where it matters.",
  "It's experimental in Next.js 14, on the canary channel. Try it and tell us what breaks.",
].map((text) => ({ text }))

describe("searchMatches", () => {
  it("finds rows containing the query, case-insensitively", () => {
    expect(searchMatches(TRANSCRIPT, "suspense")).toEqual([7, 8])
    expect(searchMatches(TRANSCRIPT, "  SUSPENSE ")).toEqual([7, 8])
  })

  it("returns [] for an empty or blank query", () => {
    expect(searchMatches(TRANSCRIPT, "")).toEqual([])
    expect(searchMatches(TRANSCRIPT, "   ")).toEqual([])
  })

  it("returns [] when nothing matches", () => {
    expect(searchMatches(TRANSCRIPT, "kubernetes")).toEqual([])
  })

  it("searches the display text, so removed fillers don't match", () => {
    const cleaned = TRANSCRIPT.map((r) => ({ text: displayText(r.text, true) }))
    expect(searchMatches(TRANSCRIPT, "um,")).toEqual([1])
    expect(searchMatches(cleaned, "um,")).toEqual([])
  })
})

describe("wrapIndex", () => {
  it("wraps negative and overflowing indices", () => {
    expect(wrapIndex(-1, 2)).toBe(1)
    expect(wrapIndex(2, 2)).toBe(0)
    expect(wrapIndex(1, 3)).toBe(1)
  })

  it("returns 0 for an empty list", () => {
    expect(wrapIndex(-1, 0)).toBe(0)
  })
})
