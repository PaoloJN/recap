import { parseTimestamp } from "@/lib/timestamps"
import type { TranscriptSegment } from "@/lib/types"

const LAST_SEGMENT_MS = 5000

function obj(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function get(value: unknown, ...path: string[]): unknown {
  let cur = value
  for (const key of path) {
    if (Array.isArray(cur)) cur = cur[Number(key)]
    else {
      const o = obj(cur)
      if (!o) return undefined
      cur = o[key]
    }
  }
  return cur
}

function parseItem(item: unknown): TranscriptSegment | null {
  const model = obj(get(item, "macroMarkersPanelItemViewModel"))
  const view = obj(
    get(model, "item", "timelineItemViewModel", "contentItems", "0", "transcriptSegmentViewModel"),
  )
  if (!model || !view || typeof view.simpleText !== "string") return null

  const seconds = get(model, "onTap", "innertubeCommand", "watchEndpoint", "startTimeSeconds")
  let startSec: number | null = null
  if (typeof seconds === "number" && Number.isFinite(seconds)) startSec = seconds
  else if (typeof view.timestamp === "string") startSec = parseTimestamp(view.timestamp.trim())
  if (startSec === null) return null

  const startMs = startSec * 1000
  return { text: view.simpleText, startMs, endMs: startMs }
}

export function parseGetPanelResponse(json: unknown, durationMs?: number): TranscriptSegment[] {
  const sections = arr(
    get(
      json,
      "content",
      "engagementPanelSectionListRenderer",
      "content",
      "sectionListRenderer",
      "contents",
    ),
  )
  const segments: TranscriptSegment[] = []
  for (const section of sections) {
    for (const item of arr(get(section, "itemSectionRenderer", "contents"))) {
      const segment = parseItem(item)
      if (segment) segments.push(segment)
    }
  }
  segments.sort((a, b) => a.startMs - b.startMs)
  for (let i = 0; i < segments.length; i++) {
    const cur = segments[i]
    if (!cur) continue
    const next = segments[i + 1]
    if (next) cur.endMs = next.startMs
    else if (durationMs !== undefined && durationMs > cur.startMs) cur.endMs = durationMs
    else cur.endMs = cur.startMs + LAST_SEGMENT_MS
  }
  return segments
}

export function chunkSegments(
  segments: TranscriptSegment[],
  minDurationMs = 12_000,
): TranscriptSegment[] {
  const blocks: TranscriptSegment[] = []
  let current: TranscriptSegment | null = null
  for (const s of segments) {
    if (!current) current = { ...s }
    else {
      current.text = `${current.text} ${s.text}`
      current.endMs = s.endMs
    }
    if (current.endMs - current.startMs >= minDurationMs) {
      blocks.push(current)
      current = null
    }
  }
  if (current) blocks.push(current)
  return blocks
}

export function filterSegments(segments: TranscriptSegment[], query: string): TranscriptSegment[] {
  const q = query.trim().toLowerCase()
  if (!q) return segments
  return segments.filter((s) => s.text.toLowerCase().includes(q))
}

export function findActiveIndex(segments: TranscriptSegment[], currentMs: number): number {
  let index = -1
  for (let i = 0; i < segments.length; i++) {
    if ((segments[i]?.startMs ?? Number.POSITIVE_INFINITY) <= currentMs) index = i
    else break
  }
  return index
}
