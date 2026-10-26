import { describe, expect, it } from "vitest"
import { FALLBACK_SUGGESTIONS, pickSuggestions } from "./ChatEmptyState"

describe("pickSuggestions", () => {
  it("uses the summary's questions when there are at least three", () => {
    expect(pickSuggestions(["a?", "b?", "c?", "d?"])).toEqual(["a?", "b?", "c?"])
  })

  it("falls back to generic suggestions otherwise", () => {
    expect(pickSuggestions(["a?", "b?"])).toBe(FALLBACK_SUGGESTIONS)
    expect(FALLBACK_SUGGESTIONS).toHaveLength(3)
  })
})
