import { describe, expect, it } from "vitest"
import { shouldCheckForUpdate, UPDATE_CHECK_INTERVAL_MS, visibleUpdateVersion } from "./notice"

describe("shouldCheckForUpdate", () => {
  it("checks on the first open and again once six hours have passed", () => {
    expect(shouldCheckForUpdate(0, Date.parse("2026-11-20T00:00:00Z"))).toBe(true)
    expect(shouldCheckForUpdate(1_000, 1_000 + UPDATE_CHECK_INTERVAL_MS - 1)).toBe(false)
    expect(shouldCheckForUpdate(1_000, 1_000 + UPDATE_CHECK_INTERVAL_MS)).toBe(true)
  })
})

describe("visibleUpdateVersion", () => {
  const base = { checkedAt: 1, latest: "2.0.4", dismissed: null }

  it("shows a newer release and hides it after that version is dismissed", () => {
    expect(visibleUpdateVersion(base, "2.0.3")).toBe("2.0.4")
    expect(visibleUpdateVersion({ ...base, dismissed: "2.0.4" }, "2.0.3")).toBeNull()
  })

  it("stays hidden when the install is already current or the cached release is older", () => {
    expect(visibleUpdateVersion(base, "2.0.4")).toBeNull()
    expect(visibleUpdateVersion(base, "2.0.10")).toBeNull()
    expect(visibleUpdateVersion({ ...base, latest: null }, "2.0.0")).toBeNull()
  })

  it("shows again when a later release arrives after an older one was dismissed", () => {
    expect(visibleUpdateVersion({ ...base, latest: "2.0.5", dismissed: "2.0.4" }, "2.0.3")).toBe(
      "2.0.5",
    )
  })
})
