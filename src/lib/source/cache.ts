import type { TranscriptSegment } from "@/lib/types"

export const MAX_TRANSCRIPT_CACHE = 40

export interface CachedTranscript {
  site: string
  lectureId: string
  segments: TranscriptSegment[]
  language: string
  isAsr: boolean
  savedAt: number
}

export type TranscriptCache = Record<string, CachedTranscript>

export function transcriptCacheKey(site: string, lectureId: string): string {
  return `${site}:${lectureId}`
}

export function readTranscriptCache(
  store: TranscriptCache,
  site: string,
  lectureId: string,
): CachedTranscript | null {
  return store[transcriptCacheKey(site, lectureId)] ?? null
}

/** Newest entries win. The input store is not mutated. */
export function writeTranscriptCache(
  store: TranscriptCache,
  entry: CachedTranscript,
): TranscriptCache {
  const key = transcriptCacheKey(entry.site, entry.lectureId)
  const next: TranscriptCache = { ...store, [key]: entry }
  const newest = Object.entries(next).sort(([, a], [, b]) => b.savedAt - a.savedAt)
  return Object.fromEntries(newest.slice(0, MAX_TRANSCRIPT_CACHE))
}
