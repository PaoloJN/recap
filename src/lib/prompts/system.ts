import { tutorInstructions } from "@/lib/tutor/prompts"
import type { TutorSettings } from "@/lib/tutor/types"
import type { AnswerLanguage, VideoContext } from "@/lib/types"
import { transcriptForPrompt, videoMetadataBlock } from "./transcript-text"

export interface ChatTutorPrompt extends TutorSettings {
  role?: string
  customInstructions?: string
}

const TRANSCRIPT_ONLY_RULES = [
  "- If the transcript does not contain the answer, say so instead of guessing.",
]

// WHY: a web turn must still be anchored in the video; web material is kept apart and cited
// so the user can tell what the video says from what was looked up.
const WEB_RULES = [
  "- You can search the web. Answer from the video first, then add what the web contributes: background, newer facts, or corrections.",
  "- Keep web material in its own final section, separate from what the video says.",
  "- Put a Markdown link to the source right after each claim taken from the web. Never invent a URL; if no source was found, say so.",
  "- Say plainly where the web contradicts the video or shows it is out of date.",
]

export function buildChatSystemPrompt(
  ctx: VideoContext,
  language: AnswerLanguage,
  tutor?: ChatTutorPrompt,
  web = false,
): string {
  const rules = [
    "You answer questions about a specific YouTube video using its transcript.",
    "",
    videoMetadataBlock(ctx),
    "",
    "Rules:",
    (language ?? "match") === "match"
      ? "- Answer in the language the user writes in."
      : `- Answer in ${language}.`,
    "- Cite moments as timestamps in m:ss form (for example 4:32), matching the transcript lines.",
    ...(web ? WEB_RULES : TRANSCRIPT_ONLY_RULES),
    "- Use Markdown.",
    "- Keep answers concise.",
  ]
  if (tutor) {
    rules.push(
      "",
      tutorInstructions(tutor, { role: tutor.role, customInstructions: tutor.customInstructions }),
    )
  }
  return [...rules, "", "TRANSCRIPT:", transcriptForPrompt(ctx)].join("\n")
}
