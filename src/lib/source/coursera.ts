import { onLocationChange } from "./location"
import { tracksFromVideo, transcriptFromTracks } from "./tracks"
import type { SourceMeta, SourceSegment, SourceTranscript, VideoSource } from "./types"
import { largestVideo, metaContent, textOf } from "./video-element"

const LECTURE = /^\/learn\/([^/]+)\/lecture\/([^/]+)/

export function lectureIdFromCoursera(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.hostname !== "www.coursera.org") return null
    const match = LECTURE.exec(parsed.pathname)
    if (!match?.[1] || !match[2]) return null
    return `${match[1]}/${decodeURIComponent(match[2])}`
  } catch {
    return null
  }
}

/** Phrase buttons Coursera renders in the transcript column. */
export function cuesFromCourseraDom(doc: Document): SourceSegment[] {
  const root =
    doc.querySelector(".rc-Transcript") ??
    doc.querySelector(".rc-VideoTranscript") ??
    doc.querySelector("[data-testid='transcript']")
  if (!root) return []
  const cues: SourceSegment[] = []
  const rows = root.querySelectorAll("[data-time], .timestamp, button")
  for (const row of rows) {
    const raw = row.getAttribute("data-time") ?? row.getAttribute("data-start")
    const start = raw === null ? Number.NaN : Number(raw)
    const text = row.textContent?.trim() ?? ""
    if (!text || !Number.isFinite(start)) continue
    const previous = cues.at(-1)
    if (previous) previous.end = start
    cues.push({ start, end: start + 5, text })
  }
  return cues
}

export const courseraSource: VideoSource = {
  id: "coursera",
  match(url) {
    return lectureIdFromCoursera(url) !== null
  },
  lectureId: lectureIdFromCoursera,
  getVideoElement(doc = document) {
    return largestVideo(doc)
  },
  async getMeta(ctx) {
    const video = this.getVideoElement(ctx.doc)
    return {
      id: ctx.lectureId,
      title: textOf(ctx.doc, "h1") || ctx.doc.title,
      course: textOf(ctx.doc, ".rc-CourseName") || textOf(ctx.doc, "[data-e2e='course-name']"),
      description: metaContent(ctx.doc, "description"),
      durationSeconds: video && Number.isFinite(video.duration) ? video.duration : 0,
      chapters: [],
      hasTranscript: null,
    } satisfies SourceMeta
  },
  async getTranscript(ctx): Promise<SourceTranscript | null> {
    const video = this.getVideoElement(ctx.doc)
    if (video) {
      const fromTracks = await transcriptFromTracks(tracksFromVideo(video))
      if (fromTracks) return fromTracks
    }
    const cues = cuesFromCourseraDom(ctx.doc)
    if (cues.length === 0) return null
    return { segments: cues, isAsr: false, language: "und" }
  },
  onNavigate(cb, doc = document) {
    const emit = () => cb(lectureIdFromCoursera(doc.location.href))
    const off = onLocationChange(emit, doc)
    emit()
    return off
  },
  mountPoint() {
    return null
  },
}
