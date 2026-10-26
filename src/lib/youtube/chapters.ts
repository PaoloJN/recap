import { parseTimestamp } from "@/lib/timestamps"
import type { Chapter } from "@/lib/types"

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === "object" ? (v as Json) : {})

const LINE_RE = /^\s*((?:\d{1,2}:)?\d{1,2}:\d{2})\s*[–—-]?\s*(.+)$/

function pickMarkers(markersMap: unknown[], key: string): unknown[] | null {
  for (const m of markersMap) {
    const entry = obj(m)
    if (entry.key !== key) continue
    const chapters = obj(entry.value).chapters
    if (Array.isArray(chapters) && chapters.length > 0) return chapters
  }
  return null
}

export function parseChaptersFromInitialData(data: unknown): Chapter[] {
  const bar = obj(
    obj(obj(obj(obj(data).playerOverlays).playerOverlayRenderer).decoratedPlayerBarRenderer)
      .decoratedPlayerBarRenderer,
  ).playerBar
  const markersMap = obj(obj(bar).multiMarkersPlayerBarRenderer).markersMap
  if (!Array.isArray(markersMap)) return []
  const raw =
    pickMarkers(markersMap, "DESCRIPTION_CHAPTERS") ?? pickMarkers(markersMap, "AUTO_CHAPTERS")
  if (!raw) return []
  const chapters: Chapter[] = []
  for (const item of raw) {
    const r = obj(obj(item).chapterRenderer)
    const title = obj(r.title).simpleText
    const ms = r.timeRangeStartMillis
    if (typeof title !== "string" || typeof ms !== "number") continue
    chapters.push({ seconds: Math.floor(ms / 1000), title })
  }
  return chapters
}

export function parseChaptersFromDescription(description: string): Chapter[] {
  const found: Chapter[] = []
  for (const line of description.split(/\r?\n/)) {
    const m = LINE_RE.exec(line)
    if (!m?.[1] || !m[2]) continue
    const seconds = parseTimestamp(m[1])
    const title = m[2].trim()
    if (seconds === null || !title) continue
    found.push({ seconds, title })
  }
  const sorted = found.sort((a, b) => a.seconds - b.seconds)
  const unique = sorted.filter((c, i) => i === 0 || c.seconds !== sorted[i - 1]?.seconds)
  if (unique.length < 2 || unique[0]?.seconds !== 0) return []
  return unique
}

export interface ChapterSegment {
  title: string
  start: number
  end: number
}

export function chapterSegments(chapters: Chapter[], durationSeconds: number): ChapterSegment[] {
  if (durationSeconds <= 0) return [{ title: "", start: 0, end: 1 }]
  const valid = chapters.filter((c) => c.seconds < durationSeconds)
  if (valid.length === 0) return [{ title: "", start: 0, end: durationSeconds }]
  const segments: ChapterSegment[] = []
  if ((valid[0]?.seconds ?? 0) > 0) segments.push({ title: "", start: 0, end: 0 })
  for (const c of valid) segments.push({ title: c.title, start: c.seconds, end: 0 })
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i] as ChapterSegment
    seg.end = Math.min(segments[i + 1]?.start ?? durationSeconds, durationSeconds)
  }
  return segments.filter((s) => s.end > s.start)
}
