import { beforeEach, describe, expect, it } from "vitest"
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
      provider: "openai",
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
