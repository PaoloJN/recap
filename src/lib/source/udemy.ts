import { onLocationChange } from "./location"
import { tracksFromVideo, transcriptFromTracks } from "./tracks"
import type { SourceMeta, SourceTranscript, VideoSource } from "./types"
import { largestVideo, metaContent, textOf } from "./video-element"
import { parseVtt } from "./vtt"

const LECTURE = /^\/course\/([^/]+)\/learn\/lecture\/(\d+)/

export interface UdemyCaption {
  url: string
  locale: string
  auto: boolean
}

/** Pull caption file URLs out of the lecture JSON Udemy embeds or returns from its API. */
export function captionsFromUdemyJson(value: unknown): UdemyCaption[] {
  const found: UdemyCaption[] = []
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return
    if (Array.isArray(node)) {
      for (const item of node) visit(item)
      return
    }
    const record = node as Record<string, unknown>
    if (Array.isArray(record.captions)) {
      for (const item of record.captions) {
        if (!item || typeof item !== "object") continue
        const caption = item as Record<string, unknown>
        const url = typeof caption.url === "string" ? caption.url : ""
        if (!url) continue
        const source = typeof caption.source === "string" ? caption.source : ""
        const locale =
          typeof caption.locale_id === "string"
            ? caption.locale_id
            : typeof caption.locale === "string"
              ? caption.locale
              : "und"
        found.push({ url, locale, auto: source === "auto" || /auto|asr/i.test(url) })
      }
    }
    for (const child of Object.values(record)) visit(child)
  }
  visit(value)
  return found
}

export function lectureIdFromUdemy(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.hostname !== "www.udemy.com") return null
    return LECTURE.exec(parsed.pathname)?.[2] ?? null
  } catch {
    return null
  }
}

function readEmbedded(doc: Document): UdemyCaption[] {
  const captions: UdemyCaption[] = []
  for (const script of doc.querySelectorAll("script")) {
    const text = script.textContent ?? ""
    if (!text.includes("captions")) continue
    const start = text.indexOf("{")
    const end = text.lastIndexOf("}")
    if (start < 0 || end <= start) continue
    try {
      captions.push(...captionsFromUdemyJson(JSON.parse(text.slice(start, end + 1))))
    } catch {
      // not the lecture payload
    }
  }
  return captions
}

async function fetchVtt(url: string): Promise<string> {
  const res = await fetch(url, { credentials: "include" })
  if (!res.ok) throw new Error(`vtt HTTP ${res.status}`)
  return res.text()
}

export const udemySource: VideoSource = {
  id: "udemy",
  match(url) {
    return lectureIdFromUdemy(url) !== null
  },
  lectureId: lectureIdFromUdemy,
  getVideoElement(doc = document) {
    return doc.querySelector<HTMLVideoElement>("video.vjs-tech") ?? largestVideo(doc)
  },
  async getMeta(ctx): Promise<SourceMeta> {
    const video = this.getVideoElement(ctx.doc)
    const title =
      textOf(ctx.doc, "[data-purpose='lecture-title']") || textOf(ctx.doc, "h1") || ctx.doc.title
    const course =
      textOf(ctx.doc, "[data-purpose='course-header-title']") ||
      textOf(ctx.doc, "[data-purpose='course-title']")
    const description =
      textOf(ctx.doc, "[data-purpose='lecture-description']") || metaContent(ctx.doc, "description")
    return {
      id: ctx.lectureId,
      title,
      course,
      description,
      durationSeconds: video && Number.isFinite(video.duration) ? video.duration : 0,
      chapters: [],
      hasTranscript: null,
    }
  },
  async getTranscript(ctx): Promise<SourceTranscript | null> {
    const captions = readEmbedded(ctx.doc)
    const manual = captions.filter((caption) => !caption.auto)
    const ordered = manual.length > 0 ? manual : captions
    for (const caption of ordered) {
      try {
        const segments = parseVtt(await fetchVtt(caption.url))
        if (segments.length > 0) {
          return {
            segments,
            isAsr: caption.auto,
            language: caption.locale.slice(0, 2) || "und",
          }
        }
      } catch {
        // try the next file, then the video element
      }
    }
    const video = this.getVideoElement(ctx.doc)
    if (!video) return null
    return transcriptFromTracks(tracksFromVideo(video))
  },
  onNavigate(cb, doc = document) {
    const emit = () => cb(lectureIdFromUdemy(doc.location.href))
    const off = onLocationChange(emit, doc)
    emit()
    return off
  },
  mountPoint() {
    return null
  },
}
