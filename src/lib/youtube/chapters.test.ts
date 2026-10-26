import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import {
  chapterSegments,
  parseChaptersFromDescription,
  parseChaptersFromInitialData,
} from "./chapters"

const html = readFileSync(resolve("src/lib/youtube/__fixtures__/watch-page.chapters.html"), "utf8")
const fixtureJson = JSON.parse(
  /var ytInitialData\s*=\s*(\{.+?\});<\/script>/s.exec(html)?.[1] ?? "",
)

const marker = (key: string, chapters: [string, number][]) => ({
  key,
  value: {
    chapters: chapters.map(([title, ms]) => ({
      chapterRenderer: { title: { simpleText: title }, timeRangeStartMillis: ms },
    })),
  },
})
const wrap = (markersMap: unknown[]) => ({
  playerOverlays: {
    playerOverlayRenderer: {
      decoratedPlayerBarRenderer: {
        decoratedPlayerBarRenderer: {
          playerBar: { multiMarkersPlayerBarRenderer: { markersMap } },
        },
      },
    },
  },
})

describe("parseChaptersFromInitialData", () => {
  it("reads DESCRIPTION_CHAPTERS from ytInitialData", () =>
    expect(parseChaptersFromInitialData(fixtureJson)).toEqual([
      { seconds: 0, title: "Turbopack for Development, Filesystem Caching" },
      { seconds: 856, title: "Instant navigations and Cache Components" },
      { seconds: 2156, title: expect.any(String) },
    ]))
  it("prefers description chapters over auto chapters, else uses auto", () => {
    const both = wrap([
      marker("AUTO_CHAPTERS", [["auto", 0]]),
      marker("DESCRIPTION_CHAPTERS", [["desc", 0]]),
    ])
    expect(parseChaptersFromInitialData(both)).toEqual([{ seconds: 0, title: "desc" }])
    expect(parseChaptersFromInitialData(wrap([marker("AUTO_CHAPTERS", [["auto", 5000]])]))).toEqual(
      [{ seconds: 5, title: "auto" }],
    )
  })
  it("returns [] for junk", () => {
    expect(parseChaptersFromInitialData(null)).toEqual([])
    expect(parseChaptersFromInitialData({})).toEqual([])
    expect(parseChaptersFromInitialData(wrap([]))).toEqual([])
  })
})

describe("parseChaptersFromDescription", () => {
  it("falls back to description timestamps", () =>
    expect(parseChaptersFromDescription("Intro\n0:00 Start\n1:30 – Middle\n12:05 End")).toEqual([
      { seconds: 0, title: "Start" },
      { seconds: 90, title: "Middle" },
      { seconds: 725, title: "End" },
    ]))
  it("ignores descriptions with a single timestamp or no 0:00", () => {
    expect(parseChaptersFromDescription("1:00 only")).toEqual([])
    expect(parseChaptersFromDescription("0:30 a\n1:00 b")).toEqual([])
  })
  it("sorts, dedupes seconds and handles h:mm:ss", () => {
    expect(parseChaptersFromDescription("1:00:00 - Late\n0:00 A\n0:00 dup\n5:00 — B")).toEqual([
      { seconds: 0, title: "A" },
      { seconds: 300, title: "B" },
      { seconds: 3600, title: "Late" },
    ])
  })
})

describe("chapterSegments", () => {
  it("covers the whole duration", () => {
    expect(chapterSegments([], 100)).toEqual([{ title: "", start: 0, end: 100 }])
    expect(chapterSegments([{ seconds: 10, title: "A" }], 100)).toEqual([
      { title: "", start: 0, end: 10 },
      { title: "A", start: 10, end: 100 },
    ])
  })
  it("drops chapters at or past the end and zero-length ones", () => {
    expect(
      chapterSegments(
        [
          { seconds: 0, title: "A" },
          { seconds: 50, title: "B" },
          { seconds: 100, title: "C" },
        ],
        100,
      ),
    ).toEqual([
      { title: "A", start: 0, end: 50 },
      { title: "B", start: 50, end: 100 },
    ])
  })
  it("never divides by zero", () => {
    expect(chapterSegments([], 0)).toEqual([{ title: "", start: 0, end: 1 }])
  })
})
