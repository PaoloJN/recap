import { describe, expect, it } from "vitest"
import {
  accessAction,
  forgetMissing,
  originPattern,
  planSiteAccess,
  rememberOrigin,
} from "./access"

describe("site access", () => {
  it("plans built-in sites, optional origins, and pages we cannot inject", () => {
    expect(planSiteAccess("https://www.youtube.com/watch?v=abc")).toEqual({ kind: "builtin" })
    expect(planSiteAccess("https://www.udemy.com/course/ml/learn/lecture/1")).toEqual({
      kind: "builtin",
    })
    expect(planSiteAccess("https://example.edu/week/1")).toEqual({
      kind: "optional",
      pattern: "https://example.edu/*",
    })
    expect(planSiteAccess("chrome://extensions")).toEqual({ kind: "ignore" })
    expect(planSiteAccess(undefined)).toEqual({ kind: "ignore" })
    expect(originPattern("http://127.0.0.1:8080/lesson")).toBe("http://127.0.0.1:8080/*")
  })

  it("prompts only for Alt+Y on an optional origin that is not granted yet", () => {
    const optional = planSiteAccess("https://example.edu/lesson")
    expect(
      accessAction(optional, { command: "toggle-panel", scriptReached: false, granted: false }),
    ).toBe("request")
    expect(
      accessAction(optional, { command: "toggle-panel", scriptReached: false, granted: true }),
    ).toBe("inject")
    expect(
      accessAction(optional, { command: "explain-moment", scriptReached: false, granted: false }),
    ).toBe("unavailable")
    expect(
      accessAction(optional, { command: "focus-mode", scriptReached: false, granted: true }),
    ).toBe("unavailable")
    expect(
      accessAction(optional, { command: "toggle-panel", scriptReached: true, granted: false }),
    ).toBe("toggle")
    expect(
      accessAction(planSiteAccess("https://www.coursera.org/learn/a/lecture/b"), {
        command: "toggle-panel",
        scriptReached: false,
        granted: false,
      }),
    ).toBe("unavailable")
  })

  it("remembers an origin and forgets one that is no longer granted", () => {
    expect(rememberOrigin(["https://a.test/*"], "https://a.test/*")).toEqual(["https://a.test/*"])
    expect(rememberOrigin(["https://a.test/*"], "https://b.test/*")).toEqual([
      "https://a.test/*",
      "https://b.test/*",
    ])
    expect(
      forgetMissing(["https://a.test/*", "https://b.test/*"], new Set(["https://a.test/*"])),
    ).toEqual(["https://a.test/*"])
  })
})
