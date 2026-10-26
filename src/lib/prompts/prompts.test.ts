import { describe, expect, it } from "vitest"
import type { VideoContext } from "@/lib/types"
import { buildSummaryPrompt, SUMMARY_PRESETS } from "./presets"
import { buildChatSystemPrompt } from "./system"
import {
  formatTranscriptForPrompt,
  TRANSCRIPT_CHAR_BUDGET,
  TRUNCATION_MARKER,
  truncateTranscript,
} from "./transcript-text"

function ctx(segments: VideoContext["transcript"]): VideoContext {
  return {
    metadata: { videoId: "abc", title: "My Title", author: "My Channel", durationSeconds: 125 },
    transcript: segments,
    language: "en",
  }
}

const small = ctx([
  { text: "hello", startMs: 0, endMs: 5000 },
  { text: "world", startMs: 5000, endMs: 9000 },
])

const big = ctx(
  Array.from({ length: 6000 }, (_, i) => ({
    text: "x".repeat(40),
    startMs: i * 1000,
    endMs: i * 1000 + 1000,
  })),
)

describe("formatTranscriptForPrompt", () => {
  it("emits one timestamped line per segment", () => {
    const lines = formatTranscriptForPrompt(small.transcript).split("\n")
    expect(lines).toEqual(["[0:00] hello", "[0:05] world"])
  })
})

describe("truncateTranscript", () => {
  it("cuts at a line boundary", () => {
    expect(truncateTranscript("a\nb\nc", 3)).toEqual({
      text: `a\nb\n${TRUNCATION_MARKER}`,
      truncated: true,
    })
  })
  it("returns short text untouched", () => {
    expect(truncateTranscript("a\nb", 10)).toEqual({ text: "a\nb", truncated: false })
  })
  it("cuts at maxChars when there is no newline", () => {
    expect(truncateTranscript("abcdef", 4)).toEqual({
      text: `abcd\n${TRUNCATION_MARKER}`,
      truncated: true,
    })
  })
  it("bounds a huge input", () => {
    const r = truncateTranscript("y".repeat(200_000))
    expect(r.truncated).toBe(true)
    expect(r.text.length).toBeLessThanOrEqual(TRANSCRIPT_CHAR_BUDGET + TRUNCATION_MARKER.length + 1)
  })
})

describe("buildChatSystemPrompt", () => {
  it("includes metadata, transcript, and no marker when within budget", () => {
    const p = buildChatSystemPrompt(small)
    expect(p).toContain("My Title")
    expect(p).toContain("My Channel")
    expect(p).toContain("2:05")
    expect(p).toContain("[0:05] world")
    expect(p).not.toContain(TRUNCATION_MARKER)
  })
  it("includes the marker when over budget", () => {
    expect(buildChatSystemPrompt(big)).toContain(TRUNCATION_MARKER)
  })
})

describe("summary presets", () => {
  it("has labels and descriptions for all presets", () => {
    for (const id of ["tldr", "detailed", "moments"] as const) {
      expect(SUMMARY_PRESETS[id].id).toBe(id)
      expect(SUMMARY_PRESETS[id].label).not.toBe("")
      expect(SUMMARY_PRESETS[id].description).not.toBe("")
    }
  })
  it("builds a user message with instructions, metadata and transcript", () => {
    const { system, user } = buildSummaryPrompt("moments", small)
    expect(user).toContain(SUMMARY_PRESETS.moments.instructions)
    expect(user).toContain("My Title")
    expect(user).toContain("[0:00] hello")
    expect(system).toContain("en")
    expect(system).toContain("m:ss")
  })
})
