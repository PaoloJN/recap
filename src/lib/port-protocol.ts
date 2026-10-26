import type { UIMessage, UIMessageChunk } from "ai"
import type { ModelSelection, SummaryPresetId, VideoContext } from "./types"

export const STREAM_PORT_NAME = "yt-ai-stream"

export type StreamRequest =
  | { kind: "chat"; messages: UIMessage[]; context: VideoContext; selection: ModelSelection }
  | { kind: "summary"; preset: SummaryPresetId; context: VideoContext; selection: ModelSelection }

export type StreamPortMessage =
  | { type: "chunk"; chunk: UIMessageChunk }
  | { type: "error"; message: string }
  | { type: "done" }

export type ToggleMessage = { type: "toggle-panel" }
