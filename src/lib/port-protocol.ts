import type { UIMessage, UIMessageChunk } from "ai"
import type { MeResponse, ProErrorCode } from "./pro/types"
import type {
  AnswerLanguage,
  ByokProviderId,
  ModelSelection,
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

export type KeyCheckRequest = { type: "validate-key"; provider: ByokProviderId; key: string }

export type KeyCheckResult =
  | { ok: true; models: string[] }
  | { ok: false; status: number | null; message: string }

export type ProSignInRequest = { type: "pro-sign-in" }
export type ProSignOutRequest = { type: "pro-sign-out" }
export type ProRefreshRequest = { type: "pro-refresh" }

export type ProAuthResult =
  | { ok: true }
  | { ok: false; reason: "cancelled" | "failed"; message: string }

export type ProSignOutResult = { ok: true }

export type ProRefreshResult =
  | { ok: true; me: MeResponse }
  | { ok: false; code: ProErrorCode; message: string }

export type RuntimeMessage =
  | ToggleMessage
  | KeyCheckRequest
  | ProSignInRequest
  | ProSignOutRequest
  | ProRefreshRequest
