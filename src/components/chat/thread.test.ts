import type { UIMessage } from "ai"
import { describe, expect, it } from "vitest"
import { markStopped, shouldClearDraft } from "./thread"

const user: UIMessage = { id: "u", role: "user", parts: [{ type: "text", text: "Hi" }] }
const reply: UIMessage = { id: "a", role: "assistant", parts: [{ type: "text", text: "Hel" }] }

describe("markStopped", () => {
  it("marks a trailing partial reply", () => {
    expect(markStopped([user, reply], () => "x").at(-1)).toEqual({
      ...reply,
      metadata: { stopped: true },
    })
  })

  it("appends an empty stopped reply when stopped before the first chunk", () => {
    expect(markStopped([user], () => "x")).toEqual([
      user,
      { id: "x", role: "assistant", parts: [], metadata: { stopped: true } },
    ])
  })

  it("leaves an empty thread alone", () => {
    expect(markStopped([], () => "x")).toEqual([])
  })
})

describe("shouldClearDraft", () => {
  it("clears only when the draft itself was sent", () => {
    expect(shouldClearDraft("Why?", "  Why? ")).toBe(true)
    expect(shouldClearDraft("Quiz me on this video with 3 questions", "half-typed")).toBe(false)
  })
})
