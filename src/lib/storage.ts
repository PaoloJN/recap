import type { UIMessage } from "ai"
import { storage } from "wxt/utils/storage"
import { PROVIDER_IDS, PROVIDERS } from "./providers"
import {
  ANSWER_LANGUAGES,
  type AnswerLanguage,
  type PanelTab,
  type ProviderId,
  type SummaryStyle,
  type TextSize,
  type ThemeSetting,
} from "./types"

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
  language: "match",
  autoSummarize: false,
  followPlayback: true,
  removeFillers: true,
  defaultStyle: "detailed",
  customInstructions: "",
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
  }
}

export const settingsItem = storage.defineItem<Settings>("local:settings", {
  fallback: DEFAULT_SETTINGS,
})

export type ApiKeys = Partial<Record<ProviderId, string>>

export const apiKeysItem = storage.defineItem<ApiKeys>("local:apiKeys", { fallback: {} })

export interface PanelState {
  open: boolean
  tab: PanelTab
}

export const panelStateItem = storage.defineItem<PanelState>("local:panel", {
  fallback: { open: false, tab: "summary" },
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

export interface MonthUsage {
  tokens: number
  summaries: number
  chats: number
}

export type UsageStore = Record<string, MonthUsage>

export const usageItem = storage.defineItem<UsageStore>("local:usage", { fallback: {} })

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

export function recordUsage(
  store: UsageStore,
  month: string,
  kind: "summary" | "chat",
  tokens: number,
): UsageStore {
  const current = store[month] ?? { tokens: 0, summaries: 0, chats: 0 }
  const updated: MonthUsage = {
    tokens: current.tokens + tokens,
    summaries: current.summaries + (kind === "summary" ? 1 : 0),
    chats: current.chats + (kind === "chat" ? 1 : 0),
  }
  const next: UsageStore = { ...store, [month]: updated }
  const newest = Object.keys(next).sort().reverse().slice(0, 2)
  return Object.fromEntries(newest.map((k) => [k, next[k] as MonthUsage]))
}
