import { describe, expect, it } from "vitest"
import { collapsedStatus } from "./collapsed-status"

const base = {
  hasKey: true,
  pageError: false,
  transcript: "ready",
  summary: "idle",
  style: "detailed",
  momentCount: 0,
} as const

describe("collapsedStatus", () => {
  it("summary done with moments", () => {
    expect(collapsedStatus({ ...base, summary: "done", momentCount: 5 })).toEqual({
      text: "Summary ready · 5 key moments",
      icon: "check",
    })
  })
  it("tldr has no moment count", () => {
    expect(collapsedStatus({ ...base, summary: "done", style: "tldr" }).text).toBe("Summary ready")
  })
  it("no key wins", () => {
    expect(collapsedStatus({ ...base, hasKey: false, transcript: "loading" })).toEqual({
      text: "Add a key to get started",
      icon: "key",
    })
  })
  it("page error comes right after no key", () => {
    expect(collapsedStatus({ ...base, pageError: true, transcript: "error" })).toEqual({
      text: "Couldn't load this video",
      icon: "warning",
    })
    expect(collapsedStatus({ ...base, hasKey: false, pageError: true }).icon).toBe("key")
  })
  it("no captions", () => {
    expect(collapsedStatus({ ...base, transcript: "unavailable" })).toEqual({
      text: "No captions on this video",
      icon: "captions",
    })
  })
  it("transcript error", () => {
    expect(collapsedStatus({ ...base, transcript: "error" })).toEqual({
      text: "Couldn't load the transcript",
      icon: "warning",
    })
  })
  it("streaming and default", () => {
    expect(collapsedStatus({ ...base, summary: "streaming" })).toEqual({
      text: "Summarizing…",
      icon: "spinner",
    })
    expect(collapsedStatus(base)).toEqual({ text: "Ready to summarize", icon: "sparkle" })
  })
})
