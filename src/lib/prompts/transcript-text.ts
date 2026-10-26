import { formatMs } from "@/lib/timestamps"
import type { TranscriptSegment, VideoContext } from "@/lib/types"

export const TRANSCRIPT_CHAR_BUDGET = 120_000
export const TRUNCATION_MARKER = "[Transcript truncated]"

export function formatTranscriptForPrompt(segments: TranscriptSegment[]): string {
  return segments.map((s) => `[${formatMs(s.startMs)}] ${s.text}`).join("\n")
}

// Keeps at most maxChars characters of transcript, cutting at the last line
// break within the limit so no line is split. Falls back to a hard cut when
// the first line alone exceeds the limit.
export function truncateTranscript(
  text: string,
  maxChars: number = TRANSCRIPT_CHAR_BUDGET,
): { text: string; truncated: boolean } {
  if (text.length <= maxChars) return { text, truncated: false }
  const lastBreak = text.lastIndexOf("\n", maxChars)
  const end = lastBreak > 0 ? lastBreak : maxChars
  return { text: `${text.slice(0, end)}\n${TRUNCATION_MARKER}`, truncated: true }
}

export function videoMetadataBlock(ctx: VideoContext): string {
  const { title, author, durationSeconds } = ctx.metadata
  return [
    `Title: ${title}`,
    `Channel: ${author}`,
    `Duration: ${formatMs(durationSeconds * 1000)}`,
    `Transcript language: ${ctx.language}`,
  ].join("\n")
}

export function transcriptForPrompt(ctx: VideoContext): string {
  return truncateTranscript(formatTranscriptForPrompt(ctx.transcript)).text
}
