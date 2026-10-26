import type { UIMessage } from "ai"
import { describe, expect, it } from "vitest"
import { expandUserMessages } from "./chat-messages"

const user = (text: string, metadata?: unknown): UIMessage => ({
  id: "u",
  role: "user",
  parts: [{ type: "text", text }],
  ...(metadata === undefined ? {} : { metadata }),
})

describe("expandUserMessages", () => {
  it("expands quote and at", () => {
    const input = user("Why?", { quote: { seconds: 14, text: "Static vs dynamic" }, at: 108 })
    const [out] = expandUserMessages([input])
    expect(out?.parts[0]).toEqual({
      type: "text",
      text: "> [0:14] Static vs dynamic\n\nWhy?\n\n(asked at 1:48)",
    })
    expect(input.parts[0]).toEqual({ type: "text", text: "Why?" })
  })
  it("handles at only", () => {
    expect(expandUserMessages([user("Hi", { at: 5 })])[0]?.parts[0]).toEqual({
      type: "text",
      text: "Hi\n\n(asked at 0:05)",
    })
  })
  it("leaves other messages untouched", () => {
    const plain = user("Hi")
    const assistant: UIMessage = {
      id: "a",
      role: "assistant",
      parts: [{ type: "text", text: "x" }],
      metadata: { at: 3 },
    }
    const out = expandUserMessages([plain, assistant, user("f", { feedback: "up" })])
    expect(out[0]).toBe(plain)
    expect(out[1]).toBe(assistant)
    expect(out[2]?.parts[0]).toEqual({ type: "text", text: "f" })
  })

  it("drops empty assistant replies", () => {
    const empty: UIMessage = { id: "a", role: "assistant", parts: [], metadata: { stopped: true } }
    const next = user("Again")
    expect(expandUserMessages([user("Hi"), empty, next])).toHaveLength(2)
  })
})
