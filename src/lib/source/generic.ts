import { onLocationChange } from "./location"
import { tracksFromVideo, transcriptFromTracks } from "./tracks"
import type { SourceMeta, SourceTranscript, VideoSource } from "./types"
import { largestVideo, metaContent } from "./video-element"

function pageId(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null
    return `${parsed.origin}${parsed.pathname}`
  } catch {
    return null
  }
}

/** Any other page with an HTML5 video. Captions come only from tracks and VTT. */
export const genericSource: VideoSource = {
  id: "generic",
  match(url) {
    return pageId(url) !== null
  },
  lectureId: pageId,
  getVideoElement(doc = document) {
    return largestVideo(doc)
  },
  async getMeta(ctx): Promise<SourceMeta> {
    const video = this.getVideoElement(ctx.doc)
    return {
      id: ctx.lectureId,
      title: ctx.doc.title,
      course: ctx.doc.location.hostname,
      description: metaContent(ctx.doc, "description"),
      durationSeconds: video && Number.isFinite(video.duration) ? video.duration : 0,
      chapters: [],
      hasTranscript: null,
    }
  },
  async getTranscript(ctx): Promise<SourceTranscript | null> {
    const video = this.getVideoElement(ctx.doc)
    if (!video) return null
    return transcriptFromTracks(tracksFromVideo(video))
  },
  onNavigate(cb, doc = document) {
    const emit = () => cb(pageId(doc.location.href))
    const off = onLocationChange(emit, doc)
    emit()
    return off
  },
  mountPoint() {
    return null
  },
}
