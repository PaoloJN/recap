import type { AnswerLanguage, DiagramDetail, VideoContext } from "@/lib/types"
import { transcriptForPrompt, videoMetadataBlock } from "./transcript-text"
import { VIDEO_TYPE_DIAGRAM_EMPHASIS, type VideoType } from "./video-type"

export type DiagramShape = "flow" | "argument" | "concept"

const CLASS_DEFS = [
  "classDef claim fill:#1d4ed8,stroke:#1e3a8a,color:#fff",
  "classDef evidence fill:#047857,stroke:#064e3b,color:#fff",
  "classDef risk fill:#b45309,stroke:#7c2d12,color:#fff",
  "classDef action fill:#6d28d9,stroke:#4c1d95,color:#fff",
].join("\n")

const SHAPE = [
  "```mermaid",
  "flowchart TD",
  '  subgraph one["Section name"]',
  '    A["Short label<br/>key detail · [1:02]"]:::claim',
  '    B["Supporting point<br/>a number, tool, or example"]:::evidence',
  "    A -->|vì| B",
  "  end",
  CLASS_DEFS,
  "```",
  "",
  "## Mốc thời gian",
  "- Short label — 1:02",
].join("\n")

/** Node budget. A 20–40 minute talk at full detail is 15–35 nodes. */
export function diagramNodeRange(
  durationSeconds: number,
  detail: DiagramDetail,
): { min: number; max: number } {
  const minutes = Number.isFinite(durationSeconds) ? Math.max(0, durationSeconds) / 60 : 0
  if (detail === "compact") {
    if (minutes < 8) return { min: 4, max: 8 }
    if (minutes < 20) return { min: 6, max: 10 }
    if (minutes < 40) return { min: 8, max: 14 }
    return { min: 10, max: 16 }
  }
  if (minutes < 8) return { min: 8, max: 14 }
  if (minutes < 20) return { min: 12, max: 22 }
  if (minutes < 40) return { min: 15, max: 35 }
  return { min: 20, max: 40 }
}

/** Tutorial is a flow, a strategy talk is an argument map, a lecture is a concept map. */
export function diagramShape(type: VideoType | null | undefined): DiagramShape {
  if (type === "strategy-talk" || type === "interview-debate") return "argument"
  if (type === "course-lecture" || type === "news-analysis") return "concept"
  return "flow"
}

function shapeRules(shape: DiagramShape): string[] {
  if (shape === "argument") {
    return [
      "Draw an argument map as one `flowchart TD`.",
      "One subgraph per main claim or section of the argument.",
      "Inside each subgraph, separate the claim, the evidence, the risk or caveat, and the action.",
      "Tag every node with exactly one of :::claim, :::evidence, :::risk, :::action.",
      "Label every edge with the relationship, using words such as vì, dẫn tới, ví dụ, or đánh đổi",
      "(or the same ideas in the label language).",
    ]
  }
  if (shape === "concept") {
    return [
      "Draw a concept map as one `flowchart LR`.",
      "One subgraph per cluster of ideas.",
      "A node is a concept. :::claim is a core idea, :::evidence is an example or definition,",
      ":::risk is a misconception or limit, :::action is how to use the idea.",
      "Label every edge with the relationship, using words such as là, gồm, ví dụ, or khác",
      "(or the same ideas in the label language).",
    ]
  }
  return [
    "Draw a flow as one `flowchart TD`.",
    "One subgraph per section or step group, in the order the video teaches them.",
    ":::action is a step, :::evidence is a command, tool, or example, :::risk is a pitfall,",
    ":::claim is the outcome of that section.",
    "Label every edge with the relationship, using words such as rồi, nếu, dẫn tới, or ví dụ",
    "(or the same ideas in the label language).",
  ]
}

function labelRule(language: AnswerLanguage | undefined, transcriptLanguage: string): string {
  const which =
    (language ?? "match") === "match"
      ? `the transcript's language (${transcriptLanguage})`
      : language
  return [
    `Write every node, subgraph, and edge label in ${which}.`,
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
    detail?: DiagramDetail
    videoType?: VideoType | null
    repair?: { code: string; error: string }
  },
): { system: string; user: string } {
  const detail: DiagramDetail = opts.detail === "compact" ? "compact" : "full"
  const shape = diagramShape(opts.videoType)
  const range = diagramNodeRange(ctx.metadata.durationSeconds, detail)
  const emphasis = opts.videoType ? VIDEO_TYPE_DIAGRAM_EMPHASIS[opts.videoType] : ""
  const system = [
    "You draw one Mermaid diagram of a YouTube video from its transcript.",
    ...shapeRules(shape),
    labelRule(opts.language, ctx.language),
    detail === "compact"
      ? "Detail level: compact. Prefer the low end of the node range. One short detail per node. At most 4 subgraphs."
      : "Detail level: full. Use the whole node range. Every node carries a concrete detail: a number, a named tool, or an example from the video.",
    `Use between ${range.min} and ${range.max} nodes, counting every node inside subgraphs.`,
    "Put a timestamp on each subgraph's main node, copied from the transcript, written as [m:ss] or [h:mm:ss] inside that node's label.",
    "The visible label is two lines: a short name, then `<br/>`, then the detail. The timestamp sits at the end of the detail.",
    emphasis ? `Emphasize: ${emphasis}` : "",
    "Skip greetings, sponsor reads, and minor asides.",
    "Reply in exactly this shape, with these literal headings and no preamble:",
    "",
    SHAPE,
    "",
    "Rules:",
    "- The mermaid block must parse as Mermaid.",
    "- End the diagram with the four classDef lines from the example, unchanged.",
    "- No %%{init} directives, no click statements, and no HTML other than <br/>.",
    "- Node ids are ASCII with no spaces. Put the visible label in double quotes.",
    "- Edge labels use the pipe form: A -->|vì| B.",
    "- Under Mốc thời gian, one line per main node, using that node's short name (the text before <br/>).",
    "- Write each of those lines as `- Short name — m:ss`.",
    "- Take every timestamp from the transcript lines.",
    '- Do not add a preamble such as "Here is the diagram" or any closing remark.',
  ]
    .filter(Boolean)
    .join("\n")

  const repair = opts.repair
  if (repair) {
    const user = [
      "The Mermaid below failed to parse. Fix the syntax only.",
      "Keep the same subgraphs, nodes, classes, edge labels, and timestamps.",
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
