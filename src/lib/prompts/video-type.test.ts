import { describe, expect, it } from "vitest"
import type { VideoContext } from "@/lib/types"
import {
  buildClassifyPrompt,
  classifyHeuristic,
  needsModelCall,
  parseClassifiedType,
  transcriptSample,
} from "./classify"
import { buildSummaryPrompt } from "./summary"
import {
  LEGACY_VIDEO_TYPE_PRESETS,
  resolveVideoTypePrompt,
  VIDEO_TYPE_PRESETS,
  VIDEO_TYPES,
  videoTypeFocus,
} from "./video-type"

const ctx: VideoContext = {
  metadata: { videoId: "abc", title: "My Title", author: "My Channel", durationSeconds: 60 },
  transcript: [
    { text: "hello", startMs: 0, endMs: 1000 },
    { text: "world", startMs: 1000, endMs: 2000 },
  ],
  language: "en",
}

describe("classifyHeuristic", () => {
  it("treats course sites as a lecture without looking at the title", () => {
    expect(classifyHeuristic({ siteId: "udemy", title: "Welcome", author: "Ada" })).toEqual({
      type: "course-lecture",
      confidence: "high",
    })
    expect(classifyHeuristic({ siteId: "coursera", title: "Week 1", author: "Ada" }).type).toBe(
      "course-lecture",
    )
    expect(
      classifyHeuristic({ siteId: "deeplearning", title: "Lab", author: "Ada" }).confidence,
    ).toBe("high")
  })

  it("reads English and Vietnamese title keywords", () => {
    expect(
      classifyHeuristic({
        siteId: "youtube",
        title: "Python tutorial: build an API",
        author: "Ada",
      }),
    ).toEqual({ type: "tutorial", confidence: "high" })
    expect(
      classifyHeuristic({
        siteId: "youtube",
        title: "Hướng dẫn lập trình backend",
        author: "Ada",
      }).type,
    ).toBe("tutorial")
    expect(
      classifyHeuristic({
        siteId: "youtube",
        title: "Keynote: chiến lược AI cho công ty",
        author: "Ada",
      }).type,
    ).toBe("strategy-talk")
    expect(
      classifyHeuristic({ siteId: "youtube", title: "Product launch demo", author: "Ada" }).type,
    ).toBe("product-demo")
    expect(
      classifyHeuristic({ siteId: "youtube", title: "Phỏng vấn về hệ thống", author: "Ada" }).type,
    ).toBe("interview-debate")
    expect(
      classifyHeuristic({ siteId: "youtube", title: "Tin tức: chuyện gì xảy ra", author: "Ada" })
        .type,
    ).toBe("news-analysis")
  })

  it("stays low confidence when the title has no type signal", () => {
    expect(
      classifyHeuristic({ siteId: "youtube", title: "Me at the zoo", author: "jawed" }),
    ).toEqual({ type: "other", confidence: "low" })
  })

  it("asks the model only when auto-detect is on, confidence is low, and a model is available", () => {
    expect(needsModelCall("high", true, true)).toBe(false)
    expect(needsModelCall("low", true, true)).toBe(true)
    expect(needsModelCall("low", false, true)).toBe(false)
    expect(needsModelCall("low", true, false)).toBe(false)
  })
})

describe("classify prompt", () => {
  it("sends the title and the first 1500 characters of the transcript", () => {
    const long = {
      ...ctx,
      transcript: [{ text: "x".repeat(2000), startMs: 0, endMs: 1 }],
    }
    expect(transcriptSample(long.transcript)).toHaveLength(1500)
    const { system, user } = buildClassifyPrompt(long)
    expect(system).toContain('{"type":"<one of the types>"}')
    expect(system).toContain("course-lecture")
    expect(user).toContain("Title: My Title")
    expect(user).toContain("x".repeat(1500))
    expect(user).not.toContain("x".repeat(1501))
  })

  it("reads a type out of a JSON reply", () => {
    expect(parseClassifiedType('```json\n{"type":"product-demo"}\n```')).toBe("product-demo")
    expect(parseClassifiedType('{"type":"nope"}')).toBeNull()
    expect(parseClassifiedType("not json")).toBeNull()
  })
})

describe("video type presets", () => {
  it("replaces every built-in brief with a practical prompt of 600–1200 characters", () => {
    for (const type of VIDEO_TYPES) {
      const text = VIDEO_TYPE_PRESETS[type]
      expect(text.length, type).toBeGreaterThanOrEqual(600)
      expect(text.length, type).toBeLessThanOrEqual(1200)
      expect(text, type).toContain("## ")
      expect(text, type).not.toMatch(/Tôi là|Bối cảnh:/)
      expect(text, type).not.toBe(LEGACY_VIDEO_TYPE_PRESETS[type])
    }
  })
})

describe("video type prompt assembly", () => {
  it("appends the type focus to the system prompt and keeps global instructions", () => {
    const preset = VIDEO_TYPE_PRESETS.tutorial
    const { system, user } = buildSummaryPrompt("detailed", ctx, {
      language: "Tiếng Việt",
      customInstructions: "Be brief",
      videoTypePrompt: preset,
    })
    expect(system).toContain(videoTypeFocus(preset))
    expect(system).toContain("## Việc cần làm")
    expect(system).toContain("backend Python")
    expect(system).toContain("## Key moments")
    expect(user).toContain("Additional instructions from the user:\nBe brief")
  })

  it("uses a saved override and otherwise the built-in preset", () => {
    expect(resolveVideoTypePrompt("news-analysis", {})).toBe(VIDEO_TYPE_PRESETS["news-analysis"])
    expect(resolveVideoTypePrompt("other", { other: "  chỉ nói ý chính  " })).toBe(
      "chỉ nói ý chính",
    )
    expect(videoTypeFocus("")).toBe("")
    expect(
      buildSummaryPrompt("tldr", ctx, { language: "match", customInstructions: "" }).system,
    ).not.toContain("Focus for this video type")
  })
})
