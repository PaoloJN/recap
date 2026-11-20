export type ProviderId = "openai" | "anthropic" | "google" | "openrouter" | "chatgpt"
export type PanelTab = "summary" | "transcript" | "chat" | "diagram"
export type SummaryStyle = "detailed" | "tldr" | "moments"
export type ThemeSetting = "youtube" | "dark" | "light"
export type TextSize = "s" | "m" | "l"
export type AnswerLanguage =
  | "match"
  | "English"
  | "Tiếng Việt"
  | "Español"
  | "Deutsch"
  | "Français"
  | "Português"
  | "日本語"
export const ANSWER_LANGUAGES: readonly AnswerLanguage[] = [
  "match",
  "English",
  "Tiếng Việt",
  "Español",
  "Deutsch",
  "Français",
  "Português",
  "日本語",
]
export type PanelView = "main" | "settings" | "onboarding"

/** A diagram node (or step) and the transcript moment it came from. */
export interface DiagramLink {
  label: string
  seconds: number
}

export interface Chapter {
  seconds: number
  title: string
}

export interface ChatMessageMetadata {
  at?: number
  quote?: { seconds: number; text: string }
  feedback?: "up"
  /** Set on an assistant reply the user stopped mid-stream. */
  stopped?: boolean
}

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
  description?: string
}

export interface CaptionTrack {
  languageCode: string
  name: string
  kind?: "asr"
}

export interface InnertubeConfig {
  client: { clientName: string; clientVersion: string; hl: string; gl: string }
}

export interface WatchPageData {
  metadata: VideoMetadata
  captionTracks: CaptionTrack[]
  innertube: InnertubeConfig
  chapters: Chapter[]
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
