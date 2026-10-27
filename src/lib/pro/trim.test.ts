import type { ModelMessage } from "ai"
import { describe, expect, it } from "vitest"
import { trimForPro } from "./trim"

const user = (content: string): ModelMessage => ({ role: "user", content })
const assistant = (content: string): ModelMessage => ({ role: "assistant", content })

/** user, assistant, user, assistant, …, ending with a user message; `count` total. */
function thread(count: number, size = 10): ModelMessage[] {
  return Array.from({ length: count }, (_, i) =>
    i % 2 === 0 ? user(`u${i}`.padEnd(size, ".")) : assistant(`a${i}`.padEnd(size, ".")),
  )
}

const chars = (system: string, messages: ModelMessage[]) =>
  system.length +
  messages.reduce(
    (n, m) =>
      n +
      (typeof m.content === "string"
        ? m.content.length
        : m.content.reduce(
            (k, p) => k + (p.type === "text" ? p.text.length : JSON.stringify(p).length),
            0,
          )),
    0,
  )

describe("trimForPro", () => {
  it("returns the messages unchanged when within limits", () => {
    const messages = thread(5)
    expect(trimForPro("sys", messages)).toEqual(messages)
  })

  it("trims a 45-message thread to ≤ 40 ending in the last user message", () => {
    const messages = thread(45)
    const out = trimForPro("sys", messages)
    expect(out.length).toBeLessThanOrEqual(40)
    expect(out.at(-1)).toBe(messages.at(-1))
    expect(out[0]?.role).toBe("user")
    // Keeps the newest messages, in order.
    expect(out).toEqual(messages.slice(messages.length - out.length))
  })

  it("drops one huge early message to fit the char limit", () => {
    const messages = [
      user("x".repeat(170_000)),
      assistant("short answer"),
      user("follow-up"),
      assistant("another answer"),
      user("latest question"),
    ]
    const out = trimForPro("system prompt", messages)
    expect(out).toEqual(messages.slice(2))
    expect(chars("system prompt", out)).toBeLessThanOrEqual(160_000)
  })

  it("counts text parts and the system prompt toward the char limit", () => {
    const messages: ModelMessage[] = [
      { role: "user", content: [{ type: "text", text: "x".repeat(60) }] },
      assistant("y".repeat(10)),
      user("z".repeat(10)),
    ]
    expect(trimForPro("s".repeat(30), messages, { chars: 100, messages: 40 })).toEqual(
      messages.slice(2),
    )
    expect(trimForPro("s".repeat(20), messages, { chars: 100, messages: 40 })).toEqual(messages)
  })

  it("never returns an assistant-first list", () => {
    // Starts with an assistant message (e.g. the summary turn) and has an odd shape.
    const messages = [assistant("intro"), ...thread(44)]
    const out = trimForPro("sys", messages)
    expect(out.length).toBeLessThanOrEqual(40)
    expect(out[0]?.role).toBe("user")
    expect(out.at(-1)).toBe(messages.at(-1))

    for (let n = 1; n <= 45; n++) {
      const trimmed = trimForPro("sys", thread(n), { chars: 160_000, messages: 4 })
      expect(trimmed[0]?.role).toBe("user")
    }
  })

  it("handles consecutive same-role messages", () => {
    const messages = [user("a"), user("b"), assistant("c"), assistant("d"), user("e"), user("f")]
    const out = trimForPro("", messages, { chars: 160_000, messages: 3 })
    expect(out[0]?.role).toBe("user")
    expect(out.at(-1)).toBe(messages.at(-1))
    expect(out.length).toBeLessThanOrEqual(3)
  })

  it("returns the last user message as-is when it alone exceeds the limits", () => {
    const huge = user("q".repeat(200_000))
    const messages = [user("old"), assistant("old answer"), huge]
    expect(trimForPro("sys", messages)).toEqual([huge])
  })

  it("returns a list with no user message unchanged (precondition)", () => {
    const messages = [assistant("a"), assistant("b")]
    expect(trimForPro("sys", messages)).toBe(messages)
  })

  it("does not mutate the input", () => {
    const messages = thread(45)
    const copy = [...messages]
    trimForPro("sys", messages)
    expect(messages).toEqual(copy)
  })
})
