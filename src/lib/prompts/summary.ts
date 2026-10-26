import type { AnswerLanguage, SummaryStyle, VideoContext } from "@/lib/types"
import { transcriptForPrompt, videoMetadataBlock } from "./transcript-text"

const QUESTIONS = ["## Questions", "- Question?"]
const SHAPES: Record<SummaryStyle, string[]> = {
  tldr: ["<lead paragraph>", "", ...QUESTIONS],
  moments: ["## Key moments", "- m:ss Text", "", ...QUESTIONS],
  detailed: [
    "<lead paragraph>",
    "",
    "## Key moments",
    "- m:ss Text",
    "",
    "## Notes",
    "- Text",
    "",
    "## In plain terms",
    "<one short paragraph>",
    "",
    ...QUESTIONS,
  ],
}

const SECTIONS: Record<SummaryStyle, string[]> = {
  tldr: [
    "Include only these parts, in this order:",
    "1. A lead paragraph of 2 to 3 sentences, with no heading.",
    "2. `## Questions`: 3 follow-up questions a viewer might ask, as `- Question?` bullets.",
    "Do not write any other section.",
  ],
  moments: [
    "Include only these parts, in this order:",
    "1. `## Key moments`: 6 to 12 bullets covering the whole video in order, each written as `- m:ss Text`.",
    "2. `## Questions`: 3 follow-up questions a viewer might ask, as `- Question?` bullets.",
    "Do not write a lead paragraph or any other section.",
  ],
  detailed: [
    "Include these parts, in this order:",
    "1. A lead paragraph of 2 to 4 sentences, with no heading.",
    "2. `## Key moments`: 4 to 7 bullets, each written as `- m:ss Text`.",
    "3. `## Notes`: 3 to 5 bullets with the most useful details, each written as `- Text`.",
    "4. `## In plain terms`: one short paragraph explaining the idea simply.",
    "5. `## Questions`: 3 follow-up questions a viewer might ask, as `- Question?` bullets.",
  ],
}

export function buildSummaryPrompt(
  style: SummaryStyle,
  ctx: VideoContext,
  opts: { language: AnswerLanguage; customInstructions: string },
): { system: string; user: string } {
  const language =
    opts.language === "match"
      ? `Write in the transcript's language (${ctx.language}).`
      : `Write in ${opts.language}.`
  const system = [
    "You write summaries of YouTube videos from their transcript.",
    language,
    "Reply in Markdown using exactly this shape, with these literal headings:",
    "",
    ...SHAPES[style],
    "",
    ...SECTIONS[style],
    "",
    "Rules:",
    "- Write each moment bullet as `- m:ss Text`: a plain m:ss timestamp (or h:mm:ss), then the text. No bold, no brackets, no links.",
    "- Use the timestamps from the transcript lines.",
    '- Do not add a preamble such as "Here is the summary" or any closing remark.',
  ].join("\n")
  const custom = opts.customInstructions.trim()
  const user = [
    videoMetadataBlock(ctx),
    "",
    "TRANSCRIPT:",
    transcriptForPrompt(ctx),
    ...(custom ? ["", `Additional instructions from the user:\n${custom}`] : []),
  ].join("\n")
  return { system, user }
}
