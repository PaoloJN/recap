import { describe, expect, it } from "vitest"
import type { StreamRequest } from "@/lib/port-protocol"
import type { VideoContext } from "@/lib/types"
import { CHATGPT_FORBIDDEN_FIELDS } from "./constants"
import { forbiddenFieldUsed, responsesBodyForRequest } from "./request"

const context: VideoContext = {
  metadata: { videoId: "abc", title: "T", author: "A", durationSeconds: 60 },
  transcript: [{ text: "hello there", startMs: 0, endMs: 1000 }],
  language: "en",
}

const selection = { provider: "chatgpt" as const, model: "gpt-6.1-sol" }

function assertBody(req: StreamRequest, snippet: string) {
  const body = responsesBodyForRequest(req)
  expect(body.model).toBe("gpt-6.1-sol")
  expect(body.instructions.length).toBeGreaterThan(0)
  expect(body.store).toBe(false)
  expect(body.stream).toBe(true)
  expect(Array.isArray(body.input)).toBe(true)
  expect(body.input.some((turn) => turn.content.includes(snippet))).toBe(true)
  expect(body.input.every((turn) => turn.role === "user" || turn.role === "assistant")).toBe(true)
  expect(Object.keys(body).sort()).toEqual(["input", "instructions", "model", "store", "stream"])
  expect(forbiddenFieldUsed(body)).toBeUndefined()
  for (const field of CHATGPT_FORBIDDEN_FIELDS) {
    expect(body).not.toHaveProperty(field)
  }
  expect(JSON.stringify(body)).not.toContain('"role":"system"')
}

describe("responsesBodyForRequest", () => {
  it("puts the summary prompt in instructions and the transcript in input", () => {
    assertBody(
      {
        kind: "summary",
        style: "detailed",
        context,
        selection,
        language: "Tiếng Việt",
        customInstructions: "",
      },
      "hello there",
    )
    const body = responsesBodyForRequest({
      kind: "summary",
      style: "detailed",
      context,
      selection,
      language: "Tiếng Việt",
      customInstructions: "",
    })
    expect(body.instructions).toContain("Tiếng Việt")
    expect(body.input).toHaveLength(1)
    expect(body.input[0]?.role).toBe("user")
  })

  it("puts the diagram prompt in instructions, including a repair, with no sampling fields", () => {
    assertBody(
      {
        kind: "diagram",
        context,
        selection,
        language: "Tiếng Việt",
        customInstructions: "",
        repair: { code: "flowchart TD\n  A -->", error: "Parse error on line 2" },
      },
      "Parse error on line 2",
    )
    const body = responsesBodyForRequest({
      kind: "diagram",
      context,
      selection,
      language: "Tiếng Việt",
      customInstructions: "",
    })
    expect(body.instructions).toContain("Mermaid")
    expect(body.instructions).not.toContain("temperature")
  })

  it("drops system chat messages", () => {
    const body = responsesBodyForRequest({
      kind: "chat",
      context,
      selection,
      language: "Tiếng Việt",
      messages: [
        { id: "s", role: "system", parts: [{ type: "text", text: "hidden system" }] },
        { id: "u", role: "user", parts: [{ type: "text", text: "Why?" }] },
      ],
    })
    expect(body.input).toEqual([{ role: "user", content: "Why?" }])
    expect(body.instructions).toContain("Tiếng Việt")
    expect(JSON.stringify(body.input)).not.toContain("hidden system")
  })
})
