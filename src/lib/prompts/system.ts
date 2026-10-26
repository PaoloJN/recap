import type { VideoContext } from "@/lib/types"
import { transcriptForPrompt, videoMetadataBlock } from "./transcript-text"

export function buildChatSystemPrompt(ctx: VideoContext): string {
  return [
    "You answer questions about a specific YouTube video using its transcript.",
    "",
    videoMetadataBlock(ctx),
    "",
    "Rules:",
    "- Answer in the language the user writes in.",
    "- Cite moments as timestamps in m:ss form (for example 4:32), matching the transcript lines.",
    "- If the transcript does not contain the answer, say so instead of guessing.",
    "- Use Markdown.",
    "- Keep answers concise.",
    "",
    "TRANSCRIPT:",
    transcriptForPrompt(ctx),
  ].join("\n")
}
