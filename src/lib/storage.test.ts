import { beforeEach, describe, expect, it } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import {
  type ChatStore,
  DEFAULT_SETTINGS,
  MAX_STORED_CHATS,
  panelStateItem,
  removeChat,
  settingsItem,
  upsertChat,
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
