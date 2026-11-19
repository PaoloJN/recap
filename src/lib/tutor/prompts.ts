import {
  formatTranscriptForPrompt,
  transcriptForPrompt,
  videoMetadataBlock,
} from "@/lib/prompts/transcript-text"
import { formatMs } from "@/lib/timestamps"
import type { AnswerLanguage, VideoContext } from "@/lib/types"
import type { ShortAnswer } from "./quiz"
import type { TutorLevel, TutorMode, TutorSettings } from "./types"
import { selectTranscriptWindow } from "./window"

const LEVEL: Record<TutorLevel, string> = {
  basic: "Level Cơ bản: define each term before using it. Short steps. No assumed background.",
  engineer:
    "Level Kỹ sư: assume they build software. Be concrete about services, data, and failure modes when the video's idea maps onto that work.",
  expert:
    "Level Chuyên gia: keep the engineering depth, and where the idea touches cost, risk, or build-versus-buy, add a short strategy view tied to that idea.",
}

export const MAX_ROLE = 80

/** One line, capped, so a role cannot rewrite the rest of the prompt. */
export function cleanRole(role: string | undefined): string {
  return (role ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_ROLE)
}

export function roleLine(role: string | undefined): string {
  const cleaned = cleanRole(role)
  if (!cleaned) {
    return "The viewer is a software engineer. Use neutral software-engineering examples, not a specific stack or job title."
  }
  return `The viewer's role is: ${cleaned}. Tailor examples to that role.`
}

const MODE: Record<TutorMode, string> = {
  qa: "Mode Hỏi đáp: answer the question directly, then one sentence on why it matters in practice.",
  explain:
    "Mode Giảng giải: teach the idea as a short lecture, with one concrete example. Do not turn it into a quiz.",
  socratic: [
    "Mode Socratic: ask exactly one guiding question, then wait.",
    "When the user has answered your previous question, first say whether that answer holds and why, in a few sentences, then ask the next single question.",
    "Do not dump the whole lesson at once.",
  ].join(" "),
}

export function tutorInstructions(
  tutor: TutorSettings,
  opts?: { role?: string; customInstructions?: string },
): string {
  const custom = opts?.customInstructions?.trim()
  return [
    "You are a teacher for the topic of this video.",
    roleLine(opts?.role),
    "Teach the topic. Do not teach English vocabulary.",
    "When an example would help, draw it from the viewer's role.",
    LEVEL[tutor.level],
    MODE[tutor.mode],
    "Cite the video as plain m:ss timestamps taken from the transcript lines (for example 4:32).",
    ...(custom ? [`Additional instructions from the user:\n${custom}`] : []),
  ].join("\n")
}

export function buildMomentMessage(
  ctx: VideoContext,
  atMs: number,
  summary: string | undefined,
): string {
  const at = formatMs(atMs)
  const window = selectTranscriptWindow(ctx.transcript, atMs)
  const excerpt =
    window.length > 0 ? formatTranscriptForPrompt(window) : "(no transcript lines in this window)"
  const overview = summary?.trim()
  return [
    `Giảng đoạn này của video, quanh ${at} (cửa sổ ±60 giây).`,
    "Giảng một lần, rõ ý chính. Đừng hỏi lại.",
    "",
    overview ? `Tóm tắt cả video:\n${overview}` : "Chưa có tóm tắt cả video.",
    "",
    "Transcript quanh thời điểm:",
    excerpt,
  ].join("\n")
}

export function buildTeachMessage(name: string): string {
  return `Hãy giảng khái niệm "${name}" trong video này. Nói nó là gì, vì sao quan trọng, và lấy ví dụ sát vai trò của người xem. Trích mốc thời gian trong video.`
}

export const AUTHOR_HEADINGS = [
  "## Luận điểm",
  "## Giả định",
  "## Bằng chứng và ý kiến",
  "## Bỏ sót và thiên kiến",
  "## So với quan điểm phổ biến",
  "## Với vai trò của bạn",
] as const

/** On-click reading of how the author argues. Not a tutor mode. */
export function buildAuthorViewPrompt(
  ctx: VideoContext,
  opts: { customInstructions: string; role?: string },
): { system: string; user: string } {
  const custom = opts.customInstructions.trim()
  const system = [
    "You analyze how the author of a YouTube video thinks, using only the transcript plus web sources when they are available.",
    "Write in Vietnamese. Keep established English technical terms as-is. Do not translate them.",
    roleLine(opts.role),
    "Separate what the author said from your interpretation.",
    "Every claim about the author cites a transcript timestamp as plain m:ss (for example 4:32).",
    "Reply in Markdown with exactly these headings, in this order, and no preamble:",
    ...AUTHOR_HEADINGS,
    "",
    "Under every heading, use only these two bullets:",
    "- `- Tác giả nói (m:ss):` for something the transcript supports. The timestamp is required.",
    "- `- Diễn giải:` for your reading. Never present a diễn giải as the author's words.",
    "",
    "What each heading covers:",
    "- Luận điểm: the author's core thesis and the stance they take.",
    "- Giả định: the assumptions their argument depends on.",
    "- Bằng chứng và ý kiến: label each point bằng chứng or ý kiến.",
    "- Bỏ sót và thiên kiến: what they omit or downplay, a counterargument, and a possible bias or incentive (for example a vendor or a sponsor). Cite the moment that grounds the inference.",
    "- So với quan điểm phổ biến: compare their view with mainstream views. When web sources are available, cite the links. When web search is unavailable, say so in a diễn giải bullet and compare only from the transcript.",
    "- Với vai trò của bạn: what this view implies for the viewer's role.",
    "Do not invent quotations.",
    ...(custom ? ["", `Additional instructions from the user:\n${custom}`] : []),
  ].join("\n")
  const user = [videoMetadataBlock(ctx), "", "TRANSCRIPT:", transcriptForPrompt(ctx)].join("\n")
  return { system, user }
}

export function buildDeeperMessage(subject: string): string {
  return [
    `Đào sâu: ${subject}`,
    "Mở rộng phần vừa nói bằng nguồn trên web nếu được, và trích link.",
    "Nếu không tra web được, vẫn giải thích sâu từ transcript.",
  ].join("\n")
}

const JSON_ONLY = "Reply with JSON only. No Markdown fences and no preamble."

export function buildConceptsPrompt(
  ctx: VideoContext,
  opts: {
    language: AnswerLanguage
    customInstructions: string
    tutor: TutorSettings
    role?: string
  },
): { system: string; user: string } {
  const language =
    opts.language === "match"
      ? `Write explanation and why in the transcript's language (${ctx.language}).`
      : `Write explanation and why in ${opts.language}.`
  const system = [
    "You extract the key technical concepts from a YouTube transcript.",
    language,
    "Keep concept names in English.",
    tutorInstructions(opts.tutor, {
      role: opts.role,
      customInstructions: opts.customInstructions,
    }),
    JSON_ONLY,
    "Shape:",
    JSON.stringify({
      concepts: [
        {
          name: "English name",
          explanation: "one or two sentences",
          why: "why it matters",
          timestamp: "m:ss",
          related: ["Other concept"],
          prerequisites: ["Concept to know first"],
        },
      ],
      mermaid: 'flowchart TD\n  c0["Name"] --> c1["Other"]',
    }),
    "Rules:",
    "- 4 to 8 concepts, the main ideas only.",
    "- timestamp is the first moment that concept appears, copied from the transcript.",
    "- prerequisites are names from this same list (cần biết trước). related are other names from this list.",
    "- mermaid is one flowchart. Node labels are the English names. An edge means the source is a prerequisite of the target.",
    "- No click statements, no HTML, no styling.",
  ].join("\n")
  const user = [videoMetadataBlock(ctx), "", "TRANSCRIPT:", transcriptForPrompt(ctx)].join("\n")
  return { system, user }
}

export function buildQuizPrompt(
  ctx: VideoContext,
  opts: {
    language: AnswerLanguage
    customInstructions: string
    tutor: TutorSettings
    role?: string
  },
): { system: string; user: string } {
  const language =
    opts.language === "match"
      ? `Write prompts and explanations in the transcript's language (${ctx.language}).`
      : `Write prompts and explanations in ${opts.language}.`
  const system = [
    "You write a 5-question quiz on the topic of a YouTube video.",
    language,
    "The viewer wants to understand the topic, not memorize English words.",
    tutorInstructions(opts.tutor, {
      role: opts.role,
      customInstructions: opts.customInstructions,
    }),
    JSON_ONLY,
    'Shape: {"questions": [ choice, short, ... ]} with exactly 5 questions.',
    "Mix multiple choice and short answer (at least two of each).",
    "Multiple choice:",
    JSON.stringify({
      id: "q1",
      kind: "choice",
      prompt: "question",
      choices: ["A", "B", "C", "D"],
      answer: 0,
      why: "why the answer is right",
      timestamp: "m:ss",
    }),
    "Short answer:",
    JSON.stringify({
      id: "q2",
      kind: "short",
      prompt: "question",
      rubric: "what a good answer must include",
      why: "short explanation of the idea",
      timestamp: "m:ss",
    }),
    "Rules:",
    "- timestamp is a moment in the transcript worth rewatching for that question.",
    "- answer is the index of the correct choice.",
    "- Ask about the ideas, not trivia.",
  ].join("\n")
  const user = [videoMetadataBlock(ctx), "", "TRANSCRIPT:", transcriptForPrompt(ctx)].join("\n")
  return { system, user }
}

export function buildGradePrompt(
  ctx: VideoContext,
  opts: {
    language: AnswerLanguage
    tutor: TutorSettings
    role?: string
    answers: readonly ShortAnswer[]
  },
): { system: string; user: string } {
  const language =
    opts.language === "match"
      ? `Write explanations in the transcript's language (${ctx.language}).`
      : `Write explanations in ${opts.language}.`
  const system = [
    "You grade short answers about a YouTube video.",
    language,
    "Be a fair teacher. correct is true only when the answer covers the rubric.",
    tutorInstructions(opts.tutor, { role: opts.role }),
    JSON_ONLY,
    'Shape: {"grades": [{"id": "q2", "correct": true, "explanation": "one or two sentences"}]}',
    "One grade per answer, using the same ids.",
  ].join("\n")
  const user = [videoMetadataBlock(ctx), "", "ANSWERS:", JSON.stringify(opts.answers)].join("\n")
  return { system, user }
}
