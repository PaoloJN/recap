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
  | { type: "error"; message: string; code?: ProErrorCode; resetsAt?: string }
  | { type: "done" }

export type ToggleMessage = { type: "toggle-panel" }

export type KeyCheckRequest = { type: "validate-key"; provider: ByokProviderId; key: string }

export type KeyCheckResult =
  | { ok: true; models: string[] }
  | { ok: false; status: number | null; message: string }

export type ProLinkStartRequest = { type: "pro-link-start"; returnUrl: string | null }
export type ProLinkPollRequest = { type: "pro-link-poll" }
export type ProLinkReopenRequest = { type: "pro-link-reopen" }
export type ProLinkCancelRequest = { type: "pro-link-cancel" }
export type ProSignOutRequest = { type: "pro-sign-out" }
export type ProRefreshRequest = { type: "pro-refresh" }

export type ProLinkStartResult = { ok: true } | { ok: false; message: string }

/**
 * Where a sign-in link stands after one claim. `idle`: no flow (never started, cancelled or
 * cleared, or a flow whose key was already delivered ran out of time). `signed-in`: the key is stored but the website hasn't finished (e.g. in checkout).
 * `done`: finished, the sign-in tab is closed and the flow cleared. `error`: a failed claim;
 * the flow is kept unless the server rejected it, in which case the next poll is `idle`.
 */
export type ProLinkState = "idle" | "pending" | "signed-in" | "done" | "expired" | "error"

export type ProLinkPollResult = { state: ProLinkState }

/** `ok: false` when there is no flow to reopen. */
export type ProLinkReopenResult = { ok: boolean }

export type ProLinkCancelResult = { ok: true }

export type ProSignOutResult = { ok: true }

export type ProRefreshResult =
  | { ok: true; me: MeResponse }
  | { ok: false; code: ProErrorCode; message: string }

export type RuntimeMessage =
  | ToggleMessage
  | KeyCheckRequest
  | ProLinkStartRequest
  | ProLinkPollRequest
  | ProLinkReopenRequest
  | ProLinkCancelRequest
  | ProSignOutRequest
  | ProRefreshRequest
