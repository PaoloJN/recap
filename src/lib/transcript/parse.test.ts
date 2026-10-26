import { describe, expect, it } from "vitest"
import type { TranscriptSegment } from "@/lib/types"
import en from "./__fixtures__/get-panel.en.json"
import ja from "./__fixtures__/get-panel.ja.json"
import { chunkSegments, filterSegments, findActiveIndex, parseGetPanelResponse } from "./parse"

const seg = (text: string, startMs: number, endMs: number): TranscriptSegment => ({
  text,
  startMs,
  endMs,
})

describe("parseGetPanelResponse", () => {
  it("parses the ja fixture", () => {
    const segs = parseGetPanelResponse(ja)
    expect(segs).toHaveLength(10)
    expect(segs[0]?.text).toBe("宇宙の有限な領域 例えば観測可能な宇宙には 有限のエネルギーがある")
    expect(segs[9]?.text).toBe("ヒラリーが大統領で ドイツが勝つ")
    expect(segs.map((s) => s.startMs)).toEqual([
      1000, 9000, 22000, 30000, 42000, 51000, 57000, 65000, 73000, 81000,
    ])
    for (let i = 0; i < segs.length - 1; i++) {
      expect(segs[i]?.endMs).toBe(segs[i + 1]?.startMs)
    }
    expect(segs[9]?.endMs).toBe(86000)
  })

  it("uses durationMs for the last segment when larger than its start", () => {
    expect(parseGetPanelResponse(ja, 90000)[9]?.endMs).toBe(90000)
    expect(parseGetPanelResponse(ja, 81000)[9]?.endMs).toBe(86000)
  })

  it("parses chapter sections in order and skips headers", () => {
    const segs = parseGetPanelResponse(en)
    expect(segs).toHaveLength(6)
    expect(segs.map((s) => s.startMs)).toEqual([0, 8000, 17000, 24000, 74000, 81000])
    expect(segs[0]?.text).toMatch(/^react a javascript library/)
    expect(segs[4]?.text).toBe(
      "react itself doesn't care about routing state management animation or",
    )
    expect(segs.some((s) => s.text.includes("Chapter"))).toBe(false)
  })

  it("returns [] for missing content or garbage", () => {
    expect(parseGetPanelResponse({ responseContext: {} })).toEqual([])
    expect(parseGetPanelResponse({})).toEqual([])
    expect(parseGetPanelResponse(null)).toEqual([])
    expect(parseGetPanelResponse("x")).toEqual([])
    expect(parseGetPanelResponse({ content: { engagementPanelSectionListRenderer: 3 } })).toEqual(
      [],
    )
  })

  it("falls back to the timestamp string and skips items without a start", () => {
    const item = (text: string, timestamp: string, start?: number) => ({
      macroMarkersPanelItemViewModel: {
        item: {
          timelineItemViewModel: {
            contentItems: [{ transcriptSegmentViewModel: { simpleText: text, timestamp } }],
          },
        },
        ...(start === undefined
          ? {}
          : { onTap: { innertubeCommand: { watchEndpoint: { startTimeSeconds: start } } } }),
      },
    })
    const json = {
      content: {
        engagementPanelSectionListRenderer: {
          content: {
            sectionListRenderer: {
              contents: [
                {
                  itemSectionRenderer: {
                    contents: [item("b", "1:05"), item("a", "0:03", 3), item("bad", "??")],
                  },
                },
              ],
            },
          },
        },
      },
    }
    const segs = parseGetPanelResponse(json)
    expect(segs).toEqual([seg("a", 3000, 65000), seg("b", 65000, 70000)])
  })
})

describe("chunkSegments", () => {
  it("merges until each block spans at least 12s", () => {
    const segs = Array.from({ length: 30 }, (_, i) => seg(`s${i}`, i * 1000, (i + 1) * 1000))
    const blocks = chunkSegments(segs)
    expect(blocks).toHaveLength(3)
    for (const b of blocks.slice(0, -1)) expect(b.endMs - b.startMs).toBeGreaterThanOrEqual(12000)
    expect(blocks[0]?.text).toBe("s0 s1 s2 s3 s4 s5 s6 s7 s8 s9 s10 s11")
    expect(blocks[0]?.startMs).toBe(0)
    expect(blocks[0]?.endMs).toBe(12000)
    expect(blocks[2]?.endMs).toBe(30000)
  })

  it("handles empty input", () => {
    expect(chunkSegments([])).toEqual([])
  })
})

describe("filterSegments", () => {
  const segs = [seg("hello world", 0, 1000), seg("bye", 1000, 2000)]
  it("is case-insensitive and trims", () => {
    expect(filterSegments(segs, " HELLO ")).toEqual([segs[0]])
  })
  it("returns all for empty query", () => {
    expect(filterSegments(segs, "  ")).toEqual(segs)
  })
})

describe("findActiveIndex", () => {
  const segs = [seg("a", 0, 5000), seg("b", 5000, 10000)]
  it("finds the last started segment", () => {
    expect(findActiveIndex(segs, 7500)).toBe(1)
    expect(findActiveIndex(segs, 0)).toBe(0)
    expect(findActiveIndex(segs, 5000)).toBe(1)
  })
  it("returns -1 before the first", () => {
    expect(findActiveIndex(segs, -1)).toBe(-1)
    expect(findActiveIndex([], 100)).toBe(-1)
  })
})
