import type { UIMessage } from "ai"
import { storage } from "wxt/utils/storage"
import type { LayoutPrefs } from "./layout/panel-layout"
import { PROVIDER_IDS, PROVIDERS } from "./providers"
import { REASONING_EFFORTS, type ReasoningEffort } from "./reasoning"
import type { TranscriptCache } from "./source/cache"
import { cleanRole, MAX_ROLE } from "./tutor/prompts"
import {
  type Concept,
  TUTOR_LEVELS,
  TUTOR_MODES,
  type TutorLevel,
  type TutorMode,
} from "./tutor/types"
import {
  ANSWER_LANGUAGES,
  type AnswerLanguage,
  type DiagramLink,
  type PanelTab,
  type ProviderId,
  type SummaryStyle,
  type TextSize,
  type ThemeSetting,
} from "./types"

export { MAX_ROLE }

export interface Settings {
  provider: ProviderId
  models: Record<ProviderId, string>
  theme: ThemeSetting
  textSize: TextSize
  language: AnswerLanguage
  autoSummarize: boolean
  followPlayback: boolean
  removeFillers: boolean
  defaultStyle: SummaryStyle
  customInstructions: string
  /** Free-text role used to tailor tutor examples. Empty means a neutral software engineer. */
  role: string
  tutorMode: TutorMode
  tutorLevel: TutorLevel
  reasoningEffort: ReasoningEffort
}

export const MAX_CUSTOM_INSTRUCTIONS = 500

export const DEFAULT_SETTINGS: Settings = {
  provider: "openai",
  models: Object.fromEntries(PROVIDER_IDS.map((id) => [id, PROVIDERS[id].defaultModel])) as Record<
    ProviderId,
    string
  >,
  theme: "youtube",
  textSize: "m",
  language: "Tiếng Việt",
  autoSummarize: false,
  followPlayback: true,
  removeFillers: true,
  defaultStyle: "detailed",
  customInstructions: "",
  role: "",
  tutorMode: "qa",
  tutorLevel: "engineer",
  reasoningEffort: "auto",
}

const THEMES: readonly ThemeSetting[] = ["youtube", "dark", "light"]
const TEXT_SIZES: readonly TextSize[] = ["s", "m", "l"]
const STYLES: readonly SummaryStyle[] = ["detailed", "tldr", "moments"]

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback
}

export function mergeSettings(stored: unknown): Settings {
  const raw = (typeof stored === "object" && stored !== null ? stored : {}) as Record<
    string,
    unknown
  >
  const rawModels = (
    typeof raw.models === "object" && raw.models !== null ? raw.models : {}
  ) as Record<string, unknown>
  const models = { ...DEFAULT_SETTINGS.models }
  for (const id of PROVIDER_IDS) {
    const m = rawModels[id]
    if (typeof m === "string" && m !== "") models[id] = m
  }
  const d = DEFAULT_SETTINGS
  return {
    provider: oneOf(raw.provider, PROVIDER_IDS, d.provider),
    models,
    theme: oneOf(raw.theme, THEMES, d.theme),
    textSize: oneOf(raw.textSize, TEXT_SIZES, d.textSize),
    language: oneOf(raw.language, ANSWER_LANGUAGES, d.language),
    autoSummarize: bool(raw.autoSummarize, d.autoSummarize),
    followPlayback: bool(raw.followPlayback, d.followPlayback),
    removeFillers: bool(raw.removeFillers, d.removeFillers),
    defaultStyle: oneOf(raw.defaultStyle, STYLES, d.defaultStyle),
    customInstructions:
      typeof raw.customInstructions === "string"
        ? raw.customInstructions.slice(0, MAX_CUSTOM_INSTRUCTIONS)
        : d.customInstructions,
    role: cleanRole(typeof raw.role === "string" ? raw.role : d.role),
    tutorMode: oneOf(raw.tutorMode, TUTOR_MODES, d.tutorMode),
    tutorLevel: oneOf(raw.tutorLevel, TUTOR_LEVELS, d.tutorLevel),
    reasoningEffort: oneOf(raw.reasoningEffort, REASONING_EFFORTS, d.reasoningEffort),
  }
}

export const settingsItem = storage.defineItem<Settings>("local:settings", {
  fallback: DEFAULT_SETTINGS,
})

export type ApiKeys = Partial<Record<ProviderId, string>>

export const apiKeysItem = storage.defineItem<ApiKeys>("local:apiKeys", { fallback: {} })

/** Signed-in flag only. Tokens stay in the background vault and are not stored here. */
export interface ChatGptSession {
  signedIn: boolean
  message: string
}

export const chatgptSessionItem = storage.defineItem<ChatGptSession>("local:chatgptSession", {
  fallback: { signedIn: false, message: "" },
})

export interface PanelState {
  open: boolean
  tab: PanelTab
}

export const panelStateItem = storage.defineItem<PanelState>("local:panel", {
  fallback: { open: false, tab: "summary" },
})

/** Sidebar width and focus mode. Kept off `local:panel` so opening a tab cannot wipe it. */
export const layoutItem = storage.defineItem<LayoutPrefs>("local:layout", {
  fallback: { width: null, focus: false },
})

export const transcriptCacheItem = storage.defineItem<TranscriptCache>("local:transcriptCache", {
  fallback: {},
})

/** Origins the user allowed for the generic video fallback, as `https://host/*` patterns. */
export const grantedOriginsItem = storage.defineItem<string[]>("local:grantedOrigins", {
  fallback: [],
})

/** Last GitHub release lookup. `checkedAt` 0 means the panel has not asked yet. */
export interface UpdateCheck {
  checkedAt: number
  latest: string | null
  dismissed: string | null
}

export const updateCheckItem = storage.defineItem<UpdateCheck>("local:updateCheck", {
  fallback: { checkedAt: 0, latest: null, dismissed: null },
})

export interface StoredChat {
  updatedAt: number
  title?: string
  messages: UIMessage[]
}

export type ChatStore = Record<string, StoredChat>

export const chatsItem = storage.defineItem<ChatStore>("local:chats", { fallback: {} })

export const MAX_STORED_CHATS = 20

export function upsertChat(
  store: ChatStore,
  videoId: string,
  messages: UIMessage[],
  now: number,
  title?: string,
): ChatStore {
  const entry: StoredChat =
    title === undefined ? { updatedAt: now, messages } : { updatedAt: now, title, messages }
  const next: ChatStore = { ...store, [videoId]: entry }
  const newestFirst = Object.entries(next).sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
  return Object.fromEntries(newestFirst.slice(0, MAX_STORED_CHATS))
}

export function removeChat(store: ChatStore, videoId: string): ChatStore {
  const { [videoId]: _removed, ...rest } = store
  return rest
}

export interface StoredSummary {
  style: SummaryStyle
  model: string
  language: string
  text: string
  feedback?: "up" | "down"
  createdAt: number
}

export type SummaryStore = Record<string, StoredSummary>

export const summariesItem = storage.defineItem<SummaryStore>("local:summaries", { fallback: {} })

export const MAX_STORED_SUMMARIES = 20

export function upsertSummary(
  store: SummaryStore,
  videoId: string,
  summary: StoredSummary,
): SummaryStore {
  const next: SummaryStore = { ...store, [videoId]: summary }
  const newestFirst = Object.entries(next).sort(([, a], [, b]) => b.createdAt - a.createdAt)
  return Object.fromEntries(newestFirst.slice(0, MAX_STORED_SUMMARIES))
}

export function removeSummary(store: SummaryStore, videoId: string): SummaryStore {
  const { [videoId]: _removed, ...rest } = store
  return rest
}

export interface StoredDiagram {
  model: string
  language: string
  code: string
  links: DiagramLink[]
  createdAt: number
}

export type DiagramStore = Record<string, StoredDiagram>

export const diagramsItem = storage.defineItem<DiagramStore>("local:diagrams", { fallback: {} })

export const MAX_STORED_DIAGRAMS = 20

export function upsertDiagram(
  store: DiagramStore,
  videoId: string,
  diagram: StoredDiagram,
): DiagramStore {
  const next: DiagramStore = { ...store, [videoId]: diagram }
  const newestFirst = Object.entries(next).sort(([, a], [, b]) => b.createdAt - a.createdAt)
  return Object.fromEntries(newestFirst.slice(0, MAX_STORED_DIAGRAMS))
}

export interface StoredConcepts {
  model: string
  language: string
  concepts: Concept[]
  mermaid: string
  createdAt: number
}

export type ConceptStore = Record<string, StoredConcepts>

export const conceptsItem = storage.defineItem<ConceptStore>("local:concepts", { fallback: {} })

export const MAX_STORED_CONCEPTS = 20

export function upsertConcepts(
  store: ConceptStore,
  videoId: string,
  concepts: StoredConcepts,
): ConceptStore {
  const next: ConceptStore = { ...store, [videoId]: concepts }
  const newestFirst = Object.entries(next).sort(([, a], [, b]) => b.createdAt - a.createdAt)
  return Object.fromEntries(newestFirst.slice(0, MAX_STORED_CONCEPTS))
}

export interface MonthUsage {
  tokens: number
  summaries: number
  chats: number
  /** Absent on usage recorded before diagrams existed. */
  diagrams?: number
}

export type UsageStore = Record<string, MonthUsage>

export const usageItem = storage.defineItem<UsageStore>("local:usage", { fallback: {} })

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

export function recordUsage(
  store: UsageStore,
  month: string,
  kind: "summary" | "chat" | "diagram",
  tokens: number,
): UsageStore {
  const current = store[month] ?? { tokens: 0, summaries: 0, chats: 0 }
  const updated: MonthUsage = {
    tokens: current.tokens + tokens,
    summaries: current.summaries + (kind === "summary" ? 1 : 0),
    chats: current.chats + (kind === "chat" ? 1 : 0),
    diagrams: (current.diagrams ?? 0) + (kind === "diagram" ? 1 : 0),
  }
  const next: UsageStore = { ...store, [month]: updated }
  const newest = Object.keys(next).sort().reverse().slice(0, 2)
  return Object.fromEntries(newest.map((k) => [k, next[k] as MonthUsage]))
}
