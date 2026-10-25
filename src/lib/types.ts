export type ProviderId = "openai" | "anthropic" | "google"
export type PanelTab = "summary" | "transcript" | "chat"
export type SummaryPresetId = "tldr" | "takeaways" | "chapters"

export interface TranscriptSegment {
  text: string
  startMs: number
  endMs: number
}

export interface VideoMetadata {
  videoId: string
  title: string
  author: string
  durationSeconds: number
}

export interface CaptionTrack {
  languageCode: string
  name: string
  kind?: "asr"
}

export interface InnertubeConfig {
  apiKey: string
  context: Record<string, unknown>
}

export interface WatchPageData {
  metadata: VideoMetadata
  captionTracks: CaptionTrack[]
  innertube: InnertubeConfig
}

export type TranscriptStatus =
  | { state: "loading" }
  | { state: "ready"; segments: TranscriptSegment[]; language: string }
  | { state: "unavailable" }
  | { state: "error"; message: string }

export interface VideoContext {
  metadata: VideoMetadata
  transcript: TranscriptSegment[]
  language: string
}

export interface ModelSelection {
  provider: ProviderId
  model: string
}
