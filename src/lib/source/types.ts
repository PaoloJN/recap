import type { Chapter } from "@/lib/types"

/** One caption cue. `start` and `end` are seconds from the beginning of the lecture. */
export interface SourceSegment {
  start: number
  end: number
  text: string
}

export interface SourceTranscript {
  segments: SourceSegment[]
  isAsr: boolean
  language: string
}

export interface SourceMeta {
  id: string
  title: string
  /** Course or channel name. Shown where YouTube shows the author. */
  course: string
  /** Glossary text: description, about-this-lecture, first screen of notes. */
  description: string
  durationSeconds: number
  chapters: Chapter[]
  /**
   * `false` when the page is known to have no captions (YouTube's track list).
   * `null` when the adapter still has to look at tracks or a VTT URL.
   */
  hasTranscript: boolean | null
}

export interface SourceContext {
  lectureId: string
  doc: Document
}

/**
 * One site the panel can read. YouTube is the first adapter; other sites return a null
 * mount point and the panel floats instead of joining the page layout.
 */
export interface VideoSource {
  id: string
  match(url: string): boolean
  lectureId(url: string): string | null
  getVideoElement(doc?: Document): HTMLVideoElement | null
  getMeta(ctx: SourceContext): Promise<SourceMeta>
  /** `null` when the lecture has no captions. Throws when a request fails. */
  getTranscript(ctx: SourceContext): Promise<SourceTranscript | null>
  onNavigate(cb: (lectureId: string | null) => void, doc?: Document): () => void
  /** Sidebar anchor. `null` means a floating drawer. */
  mountPoint(doc?: Document): HTMLElement | null
}

export const NO_CAPTIONS_MESSAGE = "Trang này không có phụ đề, bật CC rồi thử lại"
