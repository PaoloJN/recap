import { describe, expect, it } from "vitest"
import { compareVersions, isNewerVersion, parseVersion } from "./version"

describe("parseVersion", () => {
  it("accepts a chrome version and a leading v", () => {
    expect(parseVersion("2.0.10")).toEqual([2, 0, 10])
    expect(parseVersion("v2.0.1")).toEqual([2, 0, 1])
  })

  it("rejects empty and non-numeric text", () => {
    expect(parseVersion("")).toBeNull()
    expect(parseVersion("2.0.beta")).toBeNull()
  })
})

describe("isNewerVersion", () => {
  it("compares numeric segments so 2.0.10 is newer than 2.0.9", () => {
    expect(isNewerVersion("2.0.10", "2.0.9")).toBe(true)
    expect(isNewerVersion("2.0.2", "2.0.1")).toBe(true)
    expect(isNewerVersion("2.1.0", "2.0.9")).toBe(true)
    expect(isNewerVersion("v2.0.3", "2.0.2")).toBe(true)
  })

  it("treats the same version and an older release as not newer", () => {
    expect(isNewerVersion("2.0.1", "2.0.1")).toBe(false)
    expect(isNewerVersion("2.0.1", "v2.0.1")).toBe(false)
    expect(isNewerVersion("2.0.9", "2.0.10")).toBe(false)
    expect(compareVersions("2.0.1", "2.0.1")).toBe(0)
  })

  it("does not call unreadable text newer", () => {
    expect(isNewerVersion("latest", "2.0.0")).toBe(false)
    expect(isNewerVersion("2.0.1", "")).toBe(false)
  })
})
