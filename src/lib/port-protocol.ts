import type { UIMessage, UIMessageChunk } from "ai"
import type {
  AnswerLanguage,
  ModelSelection,
  ProviderId,
  SummaryStyle,
  VideoContext,
} from "./types"

export const STREAM_PORT_NAME = "yt-ai-stream"

export type StreamRequest =
  | {
      kind: "chat"
      messages: UIMessage[]
      context: VideoContext
      selection: ModelSelection
      language: AnswerLanguage
    }
  | {
      kind: "summary"
      style: SummaryStyle
      context: VideoContext
      selection: ModelSelection
      language: AnswerLanguage
      customInstructions: string
    }

export type StreamPortMessage =
  | { type: "chunk"; chunk: UIMessageChunk }
  | { type: "error"; message: string }
  | { type: "done" }

export type ToggleMessage = { type: "toggle-panel" }

export type KeyCheckRequest = { type: "validate-key"; provider: ProviderId; key: string }

export type KeyCheckResult =
  | { ok: true; models: string[] }
  | { ok: false; status: number | null; message: string }

export type RuntimeMessage = ToggleMessage | KeyCheckRequest
