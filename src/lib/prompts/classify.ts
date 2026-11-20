import type { TranscriptSegment, VideoContext } from "@/lib/types"
import { isVideoType, VIDEO_TYPES, type VideoType } from "./video-type"

export const CLASSIFY_TRANSCRIPT_CHARS = 1500

const COURSE_SITES = new Set(["udemy", "coursera", "deeplearning"])

/** Title terms that are enough on their own. Matched with or without Vietnamese diacritics. */
const TERMS: Record<Exclude<VideoType, "other">, readonly string[]> = {
  tutorial: [
    "tutorial",
    "how to",
    "how-to",
    "walkthrough",
    "crash course",
    "step by step",
    "hướng dẫn",
    "lập trình",
    "từng bước",
  ],
  "course-lecture": ["lecture", "bài giảng", "khóa học", "syllabus", "office hours"],
  "strategy-talk": ["keynote", "podcast", "chiến lược", "strategy talk", "fireside"],
  "product-demo": [
    "product demo",
    "product launch",
    "ra mắt",
    "what's new",
    "tính năng mới",
    "demo sản phẩm",
  ],
  "interview-debate": ["interview", "phỏng vấn", "debate", "tranh luận", "roundtable"],
  "news-analysis": ["news", "tin tức", "breaking", "phân tích tin", "what happened"],
}

export interface ClassifyInput {
  siteId: string
  title: string
  author: string
  description?: string
}

export interface HeuristicResult {
  type: VideoType
  confidence: "high" | "low"
}

export function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
}

function hasTerm(hay: string, term: string): boolean {
  const needle = fold(term)
  if (!needle) return false
  if (needle.includes(" ")) return hay.includes(needle)
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(hay)
}

function hits(hay: string, type: Exclude<VideoType, "other">): number {
  return TERMS[type].filter((term) => hasTerm(hay, term)).length
}

/** Cheap pass. A confident result must not trigger a model call. */
export function classifyHeuristic(input: ClassifyInput): HeuristicResult {
  if (COURSE_SITES.has(input.siteId)) return { type: "course-lecture", confidence: "high" }
  const title = fold(`${input.title} ${input.author}`)
  const description = fold(input.description ?? "")
  const ranked = (Object.keys(TERMS) as Exclude<VideoType, "other">[])
    .map((type) => ({
      type,
      titleHits: hits(title, type),
      score: hits(title, type) * 2 + hits(description, type),
    }))
    .sort((a, b) => b.score - a.score)
  const best = ranked[0]
  const second = ranked[1]
  if (!best || best.score === 0) return { type: "other", confidence: "low" }
  const alone = best.titleHits > 0 && (second?.score ?? 0) === 0
  const ahead = best.titleHits > 0 && best.score >= (second?.score ?? 0) + 2
  if (alone || ahead) return { type: best.type, confidence: "high" }
  return { type: best.type, confidence: "low" }
}

export function needsModelCall(
  confidence: "high" | "low",
  auto: boolean,
  hasModel: boolean,
): boolean {
  return auto && confidence === "low" && hasModel
}

export function transcriptSample(
  segments: TranscriptSegment[],
  max = CLASSIFY_TRANSCRIPT_CHARS,
): string {
  let out = ""
  for (const segment of segments) {
    const piece = segment.text.trim()
    if (!piece) continue
    const next = out ? `${out} ${piece}` : piece
    if (next.length > max) return next.slice(0, max)
    out = next
  }
  return out
}

export function buildClassifyPrompt(ctx: VideoContext): { system: string; user: string } {
  const types = VIDEO_TYPES.join(", ")
  const system = [
    "Classify one video. Reply with JSON only, no markdown:",
    '{"type":"<one of the types>"}',
    `Types: ${types}.`,
    "tutorial: technical or coding how-to.",
    "course-lecture: a lesson in a course.",
    "strategy-talk: keynote or podcast about AI strategy.",
    "product-demo: a launch or product demo.",
    "interview-debate: an interview or debate.",
    "news-analysis: news and what it means.",
    "other: none of the above.",
  ].join("\n")
  const sample = transcriptSample(ctx.transcript)
  const user = [
    `Title: ${ctx.metadata.title}`,
    `Channel: ${ctx.metadata.author}`,
    sample ? `Transcript start:\n${sample}` : "Transcript start: (none)",
  ].join("\n")
  return { system, user }
}

export function parseClassifiedType(text: string): VideoType | null {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const type = (JSON.parse(match[0]) as { type?: unknown }).type
    return isVideoType(type) ? type : null
  } catch {
    return null
  }
}
