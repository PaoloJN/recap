import type { UIMessage } from "ai"
import type { StreamRequest } from "@/lib/port-protocol"
import { expandUserMessages } from "@/lib/prompts/chat-messages"
import { buildDiagramPrompt } from "@/lib/prompts/diagram"
import { buildSummaryPrompt } from "@/lib/prompts/summary"
import { buildChatSystemPrompt } from "@/lib/prompts/system"
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
  }
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

export function responsesBodyForRequest(req: StreamRequest): ResponsesBody {
  if (req.kind === "chat") {
    return buildResponsesBody({
      model: req.selection.model,
      instructions: buildChatSystemPrompt(req.context, req.language),
      input: chatTurns(req.messages),
    })
  }
  if (req.kind === "summary") {
    const { system, user } = buildSummaryPrompt(req.style, req.context, {
      language: req.language,
      customInstructions: req.customInstructions,
    })
    return buildResponsesBody({
      model: req.selection.model,
      instructions: system,
      input: [{ role: "user", content: user }],
    })
  }
  const { system, user } = buildDiagramPrompt(req.context, {
    language: req.language,
    customInstructions: req.customInstructions,
    repair: req.repair,
  })
  return buildResponsesBody({
    model: req.selection.model,
    instructions: system,
    input: [{ role: "user", content: user }],
  })
}

export function responsesBodyKeys(body: ResponsesBody): string[] {
  return Object.keys(body)
}

export function forbiddenFieldUsed(body: ResponsesBody): string | undefined {
  const record = body as unknown as Record<string, unknown>
  return CHATGPT_FORBIDDEN_FIELDS.find((field) => field in record)
}
