import { describe, expect, it } from "vitest"
import {
  formatMs,
  linkifyTimestamps,
  parseTimestamp,
  TIMESTAMP_HREF_PREFIX,
  timestampFromHref,
} from "./timestamps"

describe("formatMs", () => {
  it("formats minutes and seconds", () => {
    expect(formatMs(754000)).toBe("12:34")
    expect(formatMs(5000)).toBe("0:05")
  })
  it("formats hours", () => {
    expect(formatMs(3723000)).toBe("1:02:03")
  })
})

describe("parseTimestamp", () => {
  it("parses m:ss and h:mm:ss", () => {
    expect(parseTimestamp("12:34")).toBe(754)
    expect(parseTimestamp("1:02:03")).toBe(3723)
    expect(parseTimestamp("0:05")).toBe(5)
  })
  it("rejects invalid input", () => {
    expect(parseTimestamp("3:75")).toBeNull()
    expect(parseTimestamp("16:9")).toBeNull()
    expect(parseTimestamp("2024:")).toBeNull()
    expect(parseTimestamp("1:75:03")).toBeNull()
    expect(parseTimestamp("1:2:03")).toBeNull()
  })
})

describe("linkifyTimestamps", () => {
  it("links bare timestamps", () => {
    expect(linkifyTimestamps("at 12:34")).toBe("at [12:34](#t=754)")
  })
  it("consumes brackets", () => {
    expect(linkifyTimestamps("[12:34]")).toBe("[12:34](#t=754)")
  })
  it("links several timestamps", () => {
    expect(linkifyTimestamps("1:02:03 then 0:05")).toBe("[1:02:03](#t=3723) then [0:05](#t=5)")
  })
  it("leaves a year followed by a colon untouched", () => {
    expect(linkifyTimestamps("in 2024: things")).toBe("in 2024: things")
  })
  it("leaves ratios and existing links untouched", () => {
    const input = "ratio 16:9 and [12:34](#t=754)"
    expect(linkifyTimestamps(input)).toBe(input)
  })
  it("leaves inline code untouched", () => {
    expect(linkifyTimestamps("`12:34`")).toBe("`12:34`")
  })
  it("leaves out-of-range values untouched", () => {
    expect(linkifyTimestamps("at 3:75")).toBe("at 3:75")
  })
})

describe("timestampFromHref", () => {
  it("reads the seconds", () => {
    expect(TIMESTAMP_HREF_PREFIX).toBe("#t=")
    expect(timestampFromHref("#t=754")).toBe(754)
  })
  it("ignores other hrefs", () => {
    expect(timestampFromHref("https://x")).toBeNull()
    expect(timestampFromHref("#t=abc")).toBeNull()
  })
})
