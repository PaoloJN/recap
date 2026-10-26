import { describe, expect, it } from "vitest"
import { summaryCacheKey } from "./summary-cache"

describe("summaryCacheKey", () => {
  it("joins video id and preset", () => {
    expect(summaryCacheKey("abc", "tldr")).toBe("abc:tldr")
  })

  it("differs per preset", () => {
    expect(summaryCacheKey("abc", "tldr")).not.toBe(summaryCacheKey("abc", "detailed"))
    expect(summaryCacheKey("abc", "moments")).not.toBe(summaryCacheKey("abd", "moments"))
  })
})
