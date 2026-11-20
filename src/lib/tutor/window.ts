import type { TranscriptSegment } from "@/lib/types"

/** Half-width of the "explain this moment" transcript window. */
export const MOMENT_RADIUS_MS = 60_000

/** Segments that overlap `[atMs - radius, atMs + radius]`. */
export function selectTranscriptWindow(
  segments: readonly TranscriptSegment[],
  atMs: number,
  radiusMs = MOMENT_RADIUS_MS,
): TranscriptSegment[] {
  const center = Number.isFinite(atMs) ? Math.max(0, atMs) : 0
  const radius = Number.isFinite(radiusMs) && radiusMs > 0 ? radiusMs : MOMENT_RADIUS_MS
  const start = Math.max(0, center - radius)
  const end = center + radius
  return segments.filter((segment) => segment.startMs <= end && segment.endMs >= start)
}
