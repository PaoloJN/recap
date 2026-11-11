import { describe, expect, it } from "vitest"
import { reviewUrl, UNINSTALL_URL } from "./site"

describe("site", () => {
  it("builds the Chrome review URL from the extension id", () => {
    expect(reviewUrl("abcdefgh", false)).toBe(
      "https://chromewebstore.google.com/detail/abcdefgh/reviews",
    )
  })
  it("has no review URL on Firefox", () => {
    expect(reviewUrl("abcdefgh", true)).toBeNull()
  })
  it("points the uninstall survey at the site", () => {
    expect(UNINSTALL_URL).toBe("https://recapai.dev/uninstalled")
  })
})
