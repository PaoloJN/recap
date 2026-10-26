import type { SummaryPresetId } from "@/lib/types"

/** Finished summaries, kept for the lifetime of the tab session. */
export const summaryCache = new Map<string, string>()

export function summaryCacheKey(videoId: string, preset: SummaryPresetId): string {
  return `${videoId}:${preset}`
}
