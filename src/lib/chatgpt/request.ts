import type { UIMessage } from "ai"
import type { StreamRequest } from "@/lib/port-protocol"
import { expandUserMessages } from "@/lib/prompts/chat-messages"
import { buildClassifyPrompt } from "@/lib/prompts/classify"
import { buildDiagramPrompt } from "@/lib/prompts/diagram"
import { buildSummaryPrompt } from "@/lib/prompts/summary"
import { buildChatSystemPrompt } from "@/lib/prompts/system"
import { responsesReasoning } from "@/lib/reasoning"
import {
  buildAuthorViewPrompt,
  buildConceptsPrompt,
  buildGradePrompt,
  buildQuizPrompt,
} from "@/lib/tutor/prompts"
import { CHATGPT_FORBIDDEN_FIELDS } from "./constants"

export interface ResponsesTurn {
  role: "user" | "assistant"
  content: string
}

export interface ResponsesBody {
  model: string
  instructions: string
  store: false
  stream: true
  input: ResponsesTurn[]
  tools?: { type: "web_search" }[]
  reasoning?: { effort: "low" | "medium" | "high" }
}

const EMPTY_INPUT = "Không có nội dung để gửi cho ChatGPT."
const MISSING_MODEL = "Chọn model ChatGPT trong Settings."

/**
 * Responses body for a ChatGPT-subscription token.
 * `instructions` carries the prompt. There is no system role, and the preview
 * forbids sampling and storage fields.
 */
export function buildResponsesBody(args: {
  model: string
  instructions: string
  input: readonly ResponsesTurn[]
  tools?: { type: "web_search" }[]
  reasoning?: { effort: "low" | "medium" | "high" }
}): ResponsesBody {
  const model = args.model.trim()
  if (!model) throw new Error(MISSING_MODEL)
  const instructions = args.instructions.trim()
  if (!instructions) throw new Error("Thiếu hướng dẫn cho ChatGPT.")
  const input = args.input.filter((turn) => turn.content.trim() !== "")
  if (input.length === 0) throw new Error(EMPTY_INPUT)
  return {
    model,
    instructions,
    store: false,
    stream: true,
    input: input.map((turn) => ({ ...turn })),
    ...(args.tools && args.tools.length > 0 ? { tools: args.tools } : {}),
    ...(args.reasoning ? { reasoning: args.reasoning } : {}),
  }
}

export function omitReasoning(body: ResponsesBody): ResponsesBody {
  const { reasoning: _reasoning, ...rest } = body
  return rest
}

export function omitTools(body: ResponsesBody): ResponsesBody {
  const { tools: _tools, ...rest } = body
  return rest
}

export function chatTurns(messages: UIMessage[]): ResponsesTurn[] {
  const turns: ResponsesTurn[] = []
  for (const message of expandUserMessages(messages)) {
    if (message.role !== "user" && message.role !== "assistant") continue
    const content = message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n")
      .trim()
    if (!content) continue
    turns.push({ role: message.role, content })
  }
  return turns
}

function taskPrompt(req: StreamRequest): { system: string; user: string } {
  if (req.kind === "summary") {
    return buildSummaryPrompt(req.style, req.context, {
      language: req.language,
      customInstructions: req.customInstructions,
      videoTypePrompt: req.videoTypePrompt,
    })
  }
  if (req.kind === "diagram") {
    return buildDiagramPrompt(req.context, {
      language: req.language,
      customInstructions: req.customInstructions,
      repair: req.repair,
    })
  }
  if (req.kind === "concepts") {
    return buildConceptsPrompt(req.context, {
      language: req.language,
      customInstructions: req.customInstructions,
      tutor: req.tutor,
      role: req.role,
    })
  }
  if (req.kind === "quiz") {
    return buildQuizPrompt(req.context, {
      language: req.language,
      customInstructions: req.customInstructions,
      tutor: req.tutor,
      role: req.role,
    })
  }
  if (req.kind === "grade") {
    return buildGradePrompt(req.context, {
      language: req.language,
      tutor: req.tutor,
      role: req.role,
      answers: req.answers,
    })
  }
  if (req.kind === "classify") return buildClassifyPrompt(req.context)
  if (req.kind === "author") {
    return buildAuthorViewPrompt(req.context, {
      customInstructions: req.customInstructions,
      role: req.role,
    })
  }
  throw new Error("Chat requests are not a single prompt.")
}

export function responsesBodyForRequest(req: StreamRequest): ResponsesBody {
  const reasoning = responsesReasoning(req.selection.model, req.reasoningEffort)
  const tools =
    (req.kind === "chat" || req.kind === "author") && req.web
      ? [{ type: "web_search" as const }]
      : undefined
  if (req.kind === "chat") {
    return buildResponsesBody({
      model: req.selection.model,
      instructions: buildChatSystemPrompt(
        req.context,
        req.language,
        req.tutor && {
          mode: req.tutor.mode,
          level: req.tutor.level,
          role: req.role,
          customInstructions: req.customInstructions,
        },
      ),
      input: chatTurns(req.messages),
      tools,
      reasoning,
    })
  }
  const { system, user } = taskPrompt(req)
  return buildResponsesBody({
    model: req.selection.model,
    instructions: system,
    input: [{ role: "user", content: user }],
    tools,
    reasoning,
  })
}

export function responsesBodyKeys(body: ResponsesBody): string[] {
  return Object.keys(body)
}

export function forbiddenFieldUsed(body: ResponsesBody): string | undefined {
  const record = body as unknown as Record<string, unknown>
  return CHATGPT_FORBIDDEN_FIELDS.find((field) => field in record)
}
