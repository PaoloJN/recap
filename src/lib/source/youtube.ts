import { loadTranscript } from "@/lib/transcript/fetch"
import type { TranscriptSegment, WatchPageData } from "@/lib/types"
import { onVideoChange } from "@/lib/youtube/navigation"
import { getVideoElement } from "@/lib/youtube/player"
import { fetchWatchPage } from "@/lib/youtube/watch-page"
import type { SourceContext, SourceMeta, SourceTranscript, VideoSource } from "./types"

function toSegments(segments: TranscriptSegment[]): SourceTranscript["segments"] {
  return segments.map((segment) => ({
    start: segment.startMs / 1000,
    end: segment.endMs / 1000,
    text: segment.text,
  }))
}

/** YouTube watch pages. The panel still mounts in `#secondary-inner`. */
export function createYoutubeSource(
  fetchPage: typeof fetchWatchPage = fetchWatchPage,
): VideoSource {
  let pageId: string | null = null
  let pagePromise: Promise<WatchPageData> | null = null
  const pageFor = (id: string) => {
    if (pageId !== id || !pagePromise) {
      pageId = id
      pagePromise = fetchPage(id)
    }
    return pagePromise
  }

  return {
    id: "youtube",
    match(url) {
      return this.lectureId(url) !== null
    },
    lectureId(url) {
      try {
        const parsed = new URL(url)
        if (parsed.hostname !== "www.youtube.com" || parsed.pathname !== "/watch") return null
        return parsed.searchParams.get("v") || null
      } catch {
        return null
      }
    },
    getVideoElement(doc) {
      return getVideoElement(doc)
    },
    async getMeta(ctx: SourceContext): Promise<SourceMeta> {
      const page = await pageFor(ctx.lectureId)
      return {
        id: page.metadata.videoId || ctx.lectureId,
        title: page.metadata.title,
        course: page.metadata.author,
        description: page.metadata.description ?? "",
        durationSeconds: page.metadata.durationSeconds,
        chapters: page.chapters,
        hasTranscript: page.captionTracks.length > 0,
      }
    },
    async getTranscript(ctx): Promise<SourceTranscript | null> {
      const page = await pageFor(ctx.lectureId)
      if (page.captionTracks.length === 0) return null
      const status = await loadTranscript(page, fetch, ctx.doc)
      if (status.state === "error") throw new Error(status.message)
      if (status.state !== "ready") return null
      return {
        segments: toSegments(status.segments),
        isAsr: status.asr === true,
        language: status.language,
      }
    },
    onNavigate(cb, doc) {
      return onVideoChange(cb, doc)
    },
    mountPoint(doc = document) {
      return doc.querySelector<HTMLElement>("#secondary-inner")
    },
  }
}

export const youtubeSource = createYoutubeSource()
