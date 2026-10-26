import type { SummaryStyle, VideoContext } from "@/lib/types"
import { transcriptForPrompt, videoMetadataBlock } from "./transcript-text"

export interface SummaryPreset {
  id: SummaryStyle
  label: string
  description: string
  instructions: string
}

export const SUMMARY_PRESETS: Record<SummaryStyle, SummaryPreset> = {
  tldr: {
    id: "tldr",
    label: "TL;DR",
    description: "One short paragraph",
    instructions: "Summarize the video in one paragraph of at most 120 words.",
  },
  detailed: {
    id: "detailed",
    label: "Key takeaways",
    description: "5–8 bullets with timestamps",
    instructions:
      "List the 5 to 8 most important takeaways as Markdown bullets. Start each bullet with the m:ss timestamp of the moment it comes from.",
  },
  moments: {
    id: "moments",
    label: "Chapters",
    description: "Timestamped sections",
    instructions:
      "Break the video into chapters covering the whole video in order. Write a Markdown list where each item is `**m:ss** Title: one line` describing the section.",
  },
}

export function buildSummaryPrompt(
  preset: SummaryStyle,
  ctx: VideoContext,
): { system: string; user: string } {
  const system = [
    "You write summaries of YouTube videos from their transcript.",
    `Write in the transcript's language (${ctx.language}).`,
    "Use Markdown only.",
    "Write timestamps as m:ss.",
    'Do not add a preamble such as "Here is the summary".',
  ].join("\n")
  const user = [
    SUMMARY_PRESETS[preset].instructions,
    "",
    videoMetadataBlock(ctx),
    "",
    "TRANSCRIPT:",
    transcriptForPrompt(ctx),
  ].join("\n")
  return { system, user }
}
