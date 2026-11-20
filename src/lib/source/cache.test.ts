import { describe, expect, it } from "vitest"
import { MAX_TRANSCRIPT_CACHE, readTranscriptCache, writeTranscriptCache } from "./cache"

describe("transcript cache", () => {
  it("stores a lecture and keeps the newest entries", () => {
    let store = {}
    for (let i = 0; i < MAX_TRANSCRIPT_CACHE + 2; i++) {
      store = writeTranscriptCache(store, {
        site: "udemy",
        lectureId: String(i),
        segments: [{ text: "hi", startMs: 0, endMs: 1 }],
        language: "en",
        isAsr: false,
        savedAt: i,
      })
    }
    expect(readTranscriptCache(store, "udemy", "0")).toBeNull()
    expect(readTranscriptCache(store, "udemy", "1")).toBeNull()
    expect(readTranscriptCache(store, "udemy", String(MAX_TRANSCRIPT_CACHE + 1))?.language).toBe(
      "en",
    )
    expect(Object.keys(store)).toHaveLength(MAX_TRANSCRIPT_CACHE)
  })
})
