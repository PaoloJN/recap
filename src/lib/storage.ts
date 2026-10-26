import type { UIMessage } from "ai"
import { storage } from "wxt/utils/storage"
import { PROVIDER_IDS, PROVIDERS } from "./providers"
import type { PanelTab, ProviderId } from "./types"

export interface Settings {
  provider: ProviderId
  models: Record<ProviderId, string>
}

export const DEFAULT_SETTINGS: Settings = {
  provider: "openai",
  models: Object.fromEntries(PROVIDER_IDS.map((id) => [id, PROVIDERS[id].defaultModel])) as Record<
    ProviderId,
    string
  >,
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
): ChatStore {
  const next: ChatStore = { ...store, [videoId]: { updatedAt: now, messages } }
  const newestFirst = Object.entries(next).sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
  return Object.fromEntries(newestFirst.slice(0, MAX_STORED_CHATS))
}

export function removeChat(store: ChatStore, videoId: string): ChatStore {
  const { [videoId]: _removed, ...rest } = store
  return rest
}
