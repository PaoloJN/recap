import type { AnswerLanguage, VideoContext } from "@/lib/types"
import { transcriptForPrompt, videoMetadataBlock } from "./transcript-text"

export function buildChatSystemPrompt(ctx: VideoContext, language: AnswerLanguage): string {
  return [
    "You answer questions about a specific YouTube video using its transcript.",
    "",
    videoMetadataBlock(ctx),
    "",
    "Rules:",
    (language ?? "match") === "match"
      ? "- Answer in the language the user writes in."
      : `- Answer in ${language}.`,
    "- Cite moments as timestamps in m:ss form (for example 4:32), matching the transcript lines.",
    "- If the transcript does not contain the answer, say so instead of guessing.",
    "- Use Markdown.",
    "- Keep answers concise.",
    "",
    "TRANSCRIPT:",
    transcriptForPrompt(ctx),
  ].join("\n")
}
