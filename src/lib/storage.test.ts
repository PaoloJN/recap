import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import {
  type ChatStore,
  DEFAULT_SETTINGS,
  MAX_STORED_CHATS,
  MAX_STORED_SUMMARIES,
  mergeSettings,
  monthKey,
  panelStateItem,
  recordUsage,
  removeChat,
  type SummaryStore,
  settingsItem,
  upsertChat,
  upsertSummary,
} from "./storage"

beforeEach(() => {
  fakeBrowser.reset()
})

describe("upsertChat", () => {
  it("adds a chat without mutating the input", () => {
    const store: ChatStore = {}
    const next = upsertChat(store, "a", [], 1)
    expect(next).toEqual({ a: { updatedAt: 1, messages: [] } })
    expect(store).toEqual({})
  })
  it("updates updatedAt for an existing chat", () => {
    const next = upsertChat(upsertChat({}, "a", [], 1), "a", [], 5)
    expect(next.a?.updatedAt).toBe(5)
  })
  it("evicts the oldest beyond the cap", () => {
    let store: ChatStore = {}
    for (let i = 0; i <= MAX_STORED_CHATS; i++) store = upsertChat(store, `v${i}`, [], i + 1)
    expect(Object.keys(store)).toHaveLength(MAX_STORED_CHATS)
    expect(store.v0).toBeUndefined()
    expect(store.v1).toBeDefined()
  })
})

describe("removeChat", () => {
  it("removes a chat and is a no-op when absent", () => {
    const store = upsertChat({}, "a", [], 1)
    expect(removeChat(store, "a")).toEqual({})
    expect(removeChat(store, "zz")).toEqual(store)
    expect(store.a).toBeDefined()
  })
})

describe("items", () => {
  it("settings default", async () => {
    expect(await settingsItem.getValue()).toEqual(DEFAULT_SETTINGS)
  })
  it("panel default", async () => {
    expect(await panelStateItem.getValue()).toEqual({ open: false, tab: "summary" })
  })
  it("round-trips", async () => {
    await panelStateItem.setValue({ open: true, tab: "chat" })
    expect(await panelStateItem.getValue()).toEqual({ open: true, tab: "chat" })
  })
})

describe("mergeSettings", () => {
  it("fills v2-era settings with defaults", () => {
    const merged = mergeSettings({
      provider: "google",
      models: { openai: "x", anthropic: "y", google: "z" },
    })
    expect(merged.provider).toBe("google")
    expect(merged.models.google).toBe("z")
    expect(merged.models.openrouter).toBe("openai/gpt-6-luna")
    expect(merged.theme).toBe("youtube")
    expect(merged.autoSummarize).toBe(false)
    expect(merged.removeFillers).toBe(true)
  })
  it("rejects unknown enum values", () => {
    expect(mergeSettings({ theme: "sepia", textSize: "xl", provider: "nope" })).toMatchObject({
      theme: "youtube",
      textSize: "m",
      provider: DEFAULT_SETTINGS.provider,
    })
  })
  it("truncates custom instructions and ignores non-booleans", () => {
    const merged = mergeSettings({ customInstructions: "a".repeat(600), followPlayback: "no" })
    expect(merged.customInstructions).toHaveLength(500)
    expect(merged.followPlayback).toBe(true)
  })
  it("returns defaults for non-objects", () => {
    expect(mergeSettings(null)).toEqual(DEFAULT_SETTINGS)
  })
})

// Pro on/off is a build-time constant, so these tests swap `@/lib/pro/config` with
// `vi.doMock` (the non-hoisted vi.mock) and re-import storage after `vi.resetModules`.
async function loadStorage(proEnabled: boolean) {
  vi.resetModules()
  vi.doMock("@/lib/pro/config", () => ({
    PRO_ENABLED: proEnabled,
    PRO_ORIGIN: proEnabled ? "https://recapai.dev" : null,
    proUrl: (path: string) => `https://recapai.dev${path}`,
  }))
  return import("./storage")
}

describe("mergeSettings with Recap Pro", () => {
  afterEach(() => {
    vi.doUnmock("@/lib/pro/config")
  })
  it("keeps a stored pro provider when Pro is enabled", async () => {
    const s = await loadStorage(true)
    expect(s.mergeSettings({ provider: "pro" }).provider).toBe("pro")
    expect(s.DEFAULT_SETTINGS.provider).toBe("pro")
  })
  it("falls back to openai for pro when Pro is disabled", async () => {
    const s = await loadStorage(false)
    expect(s.mergeSettings({ provider: "pro" }).provider).toBe("openai")
    expect(s.DEFAULT_SETTINGS.provider).toBe("openai")
  })
  it("keeps a BYOK provider either way", async () => {
    for (const enabled of [true, false]) {
      const s = await loadStorage(enabled)
      expect(s.mergeSettings({ provider: "anthropic" }).provider).toBe("anthropic")
    }
  })
  it("pins the pro model to pro", async () => {
    const s = await loadStorage(true)
    const merged = s.mergeSettings({ models: { pro: "something-else", openai: "x" } })
    expect(merged.models.pro).toBe("pro")
    expect(merged.models.openai).toBe("x")
  })
  it("defines an empty Pro state", async () => {
    const s = await loadStorage(false)
    expect(await s.proItem.getValue()).toEqual({ token: null, me: null, fetchedAt: 0 })
  })
})

describe("upsertSummary", () => {
  const summary = (createdAt: number) => ({
    style: "tldr" as const,
    model: "m",
    language: "English",
    text: "t",
    createdAt,
  })
  it("evicts the oldest beyond MAX_STORED_SUMMARIES", () => {
    let store: SummaryStore = {}
    for (let i = 0; i <= MAX_STORED_SUMMARIES; i++)
      store = upsertSummary(store, `v${i}`, summary(i + 1))
    expect(Object.keys(store)).toHaveLength(MAX_STORED_SUMMARIES)
    expect(store.v0).toBeUndefined()
    expect(store.v1).toBeDefined()
  })
})

describe("usage", () => {
  it("recordUsage adds tokens and counts, and keeps only two months", () => {
    let s = recordUsage({}, "2026-08", "chat", 10)
    s = recordUsage(s, "2026-09", "summary", 20)
    s = recordUsage(s, "2026-10", "summary", 5)
    expect(Object.keys(s).sort()).toEqual(["2026-09", "2026-10"])
    expect(s["2026-10"]).toEqual({ tokens: 5, summaries: 1, chats: 0 })
  })
  it("monthKey pads the month", () => {
    expect(monthKey(new Date(2026, 0, 5))).toBe("2026-01")
  })
})
