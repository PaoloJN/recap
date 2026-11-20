import type { UIMessage, UIMessageChunk } from "ai"
import type { ReasoningEffort } from "./reasoning"
import type { ShortAnswer } from "./tutor/quiz"
import type { TutorSettings } from "./tutor/types"
import type {
  AnswerLanguage,
  ModelSelection,
  ProviderId,
  SummaryStyle,
  VideoContext,
} from "./types"

export const STREAM_PORT_NAME = "yt-ai-stream"

interface StreamBase {
  context: VideoContext
  selection: ModelSelection
  language: AnswerLanguage
  /** Omitted or `auto` sends no reasoning parameter. */
  reasoningEffort?: ReasoningEffort
}

export type StreamRequest =
  | (StreamBase & {
      kind: "chat"
      messages: UIMessage[]
      tutor?: TutorSettings
      role?: string
      customInstructions?: string
      /** Ask the provider for a web search. A rejection retries without it. */
      web?: boolean
    })
  | (StreamBase & {
      kind: "summary"
      style: SummaryStyle
      customInstructions: string
      /** Focus text for the detected video type. Empty means no type focus. */
      videoTypePrompt?: string
    })
  | (StreamBase & {
      kind: "classify"
    })
  | (StreamBase & {
      kind: "diagram"
      customInstructions: string
      /** Set when the first reply was not valid Mermaid. The model is asked to fix syntax only. */
      repair?: { code: string; error: string }
    })
  | (StreamBase & {
      kind: "concepts" | "quiz"
      customInstructions: string
      tutor: TutorSettings
      role?: string
    })
  | (StreamBase & {
      kind: "author"
      customInstructions: string
      tutor: TutorSettings
      role?: string
      /** Compare with mainstream views. A rejection retries without web search. */
      web?: boolean
    })
  | (StreamBase & {
      kind: "grade"
      customInstructions: string
      tutor: TutorSettings
      role?: string
      answers: ShortAnswer[]
    })

export type StreamPortMessage =
  | { type: "chunk"; chunk: UIMessageChunk }
  | { type: "error"; message: string }
  | { type: "done" }

export type ToggleMessage =
  | { type: "toggle-panel" }
  | { type: "explain-moment" }
  | { type: "focus-mode" }

export type KeyCheckRequest = { type: "validate-key"; provider: ProviderId; key: string }

export type KeyCheckResult =
  | { ok: true; models: string[] }
  | { ok: false; status: number | null; message: string }

export type RuntimeMessage = ToggleMessage | KeyCheckRequest
