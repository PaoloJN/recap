import { describe, expect, it } from "vitest"
import type { VideoContext } from "@/lib/types"
import { buildSummaryPrompt } from "./summary"
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
    const p = buildChatSystemPrompt(small, "match")
    expect(p).toContain("My Title")
    expect(p).toContain("My Channel")
    expect(p).toContain("2:05")
    expect(p).toContain("[0:05] world")
    expect(p).not.toContain(TRUNCATION_MARKER)
  })
  it("includes the marker when over budget", () => {
    expect(buildChatSystemPrompt(big, "match")).toContain(TRUNCATION_MARKER)
  })
})

describe("buildSummaryPrompt", () => {
  const opts = { language: "match" as const, customInstructions: "" }
  it("fixes the section shape in the system prompt", () => {
    const { system } = buildSummaryPrompt("detailed", small, opts)
    for (const h of ["## Key moments", "## Notes", "## In plain terms", "## Questions"]) {
      expect(system).toContain(h)
    }
    expect(system).toContain("- m:ss Text")
  })
  it("tldr only asks for the lead and questions, in a named language", () => {
    const { system, user } = buildSummaryPrompt("tldr", small, {
      language: "Deutsch",
      customInstructions: "Be brief",
    })
    expect(system).toContain("Write in Deutsch.")
    expect(system).toContain("## Questions")
    expect(system).not.toContain("## Notes")
    expect(user).toContain("Additional instructions from the user:\nBe brief")
  })
  it("match uses the transcript language and omits empty custom instructions", () => {
    const { system, user } = buildSummaryPrompt("moments", small, opts)
    expect(system).toContain("Write in the transcript's language (en).")
    expect(system).toContain("## Key moments")
    expect(system).not.toContain("## Notes")
    expect(user).not.toContain("Additional instructions")
    expect(user).toContain("My Title")
    expect(user).toContain("[0:00] hello")
  })
})

describe("legacy settings", () => {
  it("does not throw when new fields are missing", () => {
    const legacy = {} as unknown as Parameters<typeof buildSummaryPrompt>[2]
    expect(() => buildSummaryPrompt("detailed", small, legacy)).not.toThrow()
    expect(buildSummaryPrompt("detailed", small, legacy).system).toContain("transcript's language")
  })
})

describe("buildChatSystemPrompt language", () => {
  it("keeps match as answer-in-user-language and pins a named language", () => {
    expect(buildChatSystemPrompt(small, "match")).toContain(
      "Answer in the language the user writes in.",
    )
    expect(buildChatSystemPrompt(small, "Deutsch")).toContain("Answer in Deutsch.")
  })
})
