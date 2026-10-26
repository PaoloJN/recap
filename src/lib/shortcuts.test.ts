import { describe, expect, it } from "vitest"
import { isEditableTarget, matchShortcut } from "./shortcuts"

const key = (code: string, extra: Partial<Parameters<typeof matchShortcut>[0]> = {}) => ({
  code,
  altKey: true,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  ...extra,
})

describe("matchShortcut", () => {
  it("matches by code, ignoring the typed character", () => {
    expect(matchShortcut({ ...key("KeyS"), key: "ß" } as never)).toBe("summarize")
    expect(matchShortcut(key("KeyC"))).toBe("focus-chat")
    expect(matchShortcut(key("KeyF"))).toBe("search-transcript")
  })
  it("rejects extra modifiers, missing alt and other keys", () => {
    expect(matchShortcut(key("KeyS", { shiftKey: true }))).toBeNull()
    expect(matchShortcut(key("KeyS", { ctrlKey: true }))).toBeNull()
    expect(matchShortcut(key("KeyS", { metaKey: true }))).toBeNull()
    expect(matchShortcut(key("KeyS", { altKey: false }))).toBeNull()
    expect(matchShortcut(key("KeyY"))).toBeNull()
  })
})

describe("isEditableTarget", () => {
  it("is true for textareas, inputs and YouTube's searchbox", () => {
    expect(isEditableTarget(document.createElement("textarea"))).toBe(true)
    const box = document.createElement("ytd-searchbox")
    const input = document.createElement("input")
    box.append(input)
    expect(isEditableTarget(input)).toBe(true)
  })
  it("is true for contenteditable regions", () => {
    const div = document.createElement("div")
    div.setAttribute("contenteditable", "true")
    const span = document.createElement("span")
    div.append(span)
    expect(isEditableTarget(span)).toBe(true)
  })
  it("is false for plain elements and null", () => {
    expect(isEditableTarget(document.createElement("div"))).toBe(false)
    expect(isEditableTarget(null)).toBe(false)
  })
})
