import type { AnswerLanguage, VideoContext } from "@/lib/types"
import { transcriptForPrompt, videoMetadataBlock } from "./transcript-text"

const SHAPE = ["```mermaid", "<diagram>", "```", "", "## Mốc thời gian", "- <label> — m:ss"].join(
  "\n",
)

function labelRule(language: AnswerLanguage | undefined, transcriptLanguage: string): string {
  const which =
    (language ?? "match") === "match"
      ? `the transcript's language (${transcriptLanguage})`
      : language
  return [
    `Write every node and edge label in ${which}.`,
    "Keep established English technical terms as-is (product names, protocols,",
    "libraries, and identifiers such as API Gateway, Kafka, Redis, or WebSocket).",
    "Do not translate those terms.",
  ].join(" ")
}

export function buildDiagramPrompt(
  ctx: VideoContext,
  opts: {
    language: AnswerLanguage
    customInstructions: string
    repair?: { code: string; error: string }
  },
): { system: string; user: string } {
  const system = [
    "You draw one Mermaid diagram of a YouTube video from its transcript.",
    "Pick the single best type for what the video explains:",
    "- flowchart: architecture, system flow, or how the main concepts relate.",
    "- sequenceDiagram: a request or call flow between parts.",
    "- stateDiagram-v2: a lifecycle or state machine.",
    "- classDiagram or erDiagram: only when the video is about types or a data model.",
    labelRule(opts.language, ctx.language),
    "Focus on the main ideas. Skip greetings, sponsor reads, and minor asides.",
    "Reply in exactly this shape, with these literal headings and no preamble:",
    "",
    SHAPE,
    "",
    "Rules:",
    "- The mermaid block must parse as Mermaid.",
    "- No %%{init} directives, no click statements, no HTML, and no styling.",
    "- Use 4 to 12 nodes. Keep labels short.",
    '- Node ids are ASCII. Put the visible label in quotes, for example A["Cổng API"].',
    "- Under Mốc thời gian, one line per important node, using the same visible labels.",
    "- Write each of those lines as `- Label — m:ss`.",
    "- Take every timestamp from the transcript lines.",
    '- Do not add a preamble such as "Here is the diagram" or any closing remark.',
  ].join("\n")

  const repair = opts.repair
  if (repair) {
    const user = [
      "The Mermaid below failed to parse. Fix the syntax only.",
      "Keep the same nodes, labels, and timestamps.",
      "",
      "Error:",
      repair.error,
      "",
      "Broken diagram:",
      "```mermaid",
      repair.code,
      "```",
      "",
      "Return the full reply in the required shape.",
    ].join("\n")
    return { system, user }
  }

  const custom = (opts.customInstructions ?? "").trim()
  const user = [
    videoMetadataBlock(ctx),
    "",
    "TRANSCRIPT:",
    transcriptForPrompt(ctx),
    ...(custom ? ["", `Additional instructions from the user:\n${custom}`] : []),
  ].join("\n")
  return { system, user }
}
