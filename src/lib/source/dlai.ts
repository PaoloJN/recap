import { onLocationChange } from "./location"
import { tracksFromVideo, transcriptFromTracks } from "./tracks"
import type { SourceMeta, SourceSegment, SourceTranscript, VideoSource } from "./types"
import { largestVideo, metaContent, textOf } from "./video-element"

export function lectureIdFromDlai(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.hostname !== "learn.deeplearning.ai") return null
    if (!parsed.pathname.startsWith("/courses/")) return null
    return parsed.pathname
  } catch {
    return null
  }
}

/** Timed rows in a DeepLearning.AI transcript panel, when the page renders one. */
export function cuesFromDlaiDom(doc: Document): SourceSegment[] {
  const root =
    doc.querySelector(".transcript-panel") ??
    doc.querySelector("[class*='transcript']") ??
    doc.querySelector("[data-testid='transcript']")
  if (!root) return []
  const cues: SourceSegment[] = []
  for (const row of root.querySelectorAll("[data-start]")) {
    const start = Number(row.getAttribute("data-start"))
    const endRaw = row.getAttribute("data-end")
    const end = endRaw === null ? start + 5 : Number(endRaw)
    const text = row.textContent?.trim() ?? ""
    if (!text || !Number.isFinite(start)) continue
    cues.push({ start, end: Number.isFinite(end) ? end : start, text })
  }
  return cues
}

export const dlaiSource: VideoSource = {
  id: "deeplearning",
  match(url) {
    return lectureIdFromDlai(url) !== null
  },
  lectureId: lectureIdFromDlai,
  getVideoElement(doc = document) {
    return largestVideo(doc)
  },
  async getMeta(ctx): Promise<SourceMeta> {
    const video = this.getVideoElement(ctx.doc)
    return {
      id: ctx.lectureId,
      title: textOf(ctx.doc, "h1") || ctx.doc.title,
      course: textOf(ctx.doc, ".course-title") || textOf(ctx.doc, "[data-course-title]"),
      description: metaContent(ctx.doc, "description"),
      durationSeconds: video && Number.isFinite(video.duration) ? video.duration : 0,
      chapters: [],
      hasTranscript: null,
    }
  },
  async getTranscript(ctx): Promise<SourceTranscript | null> {
    const video = this.getVideoElement(ctx.doc)
    if (video) {
      const fromTracks = await transcriptFromTracks(tracksFromVideo(video))
      if (fromTracks) return fromTracks
    }
    const cues = cuesFromDlaiDom(ctx.doc)
    if (cues.length === 0) return null
    return { segments: cues, isAsr: false, language: "und" }
  },
  onNavigate(cb, doc = document) {
    const emit = () => cb(lectureIdFromDlai(doc.location.href))
    const off = onLocationChange(emit, doc)
    emit()
    return off
  },
  mountPoint() {
    return null
  },
}
