import { describe, expect, it } from "vitest"
import type { VideoContext } from "@/lib/types"
import { conceptMermaid, parseConcepts } from "./concepts"
import {
  AUTHOR_HEADINGS,
  buildAuthorViewPrompt,
  buildNodeAskDraft,
  buildNodeExplainMessage,
  tutorInstructions,
} from "./prompts"
import { gradeChoice, parseGrades, parseQuiz } from "./quiz"
import { isWebToolRejection, openRouterOnlineModel, WEB_NOTE } from "./web"
import { selectTranscriptWindow } from "./window"

const ctx: VideoContext = {
  metadata: { videoId: "v", title: "Queues", author: "Ada", durationSeconds: 300 },
  language: "en",
  transcript: [
    { text: "a queue buffers work", startMs: 0, endMs: 10_000 },
    { text: "backpressure slows producers", startMs: 50_000, endMs: 70_000 },
    { text: "retries need a limit", startMs: 130_000, endMs: 140_000 },
  ],
}

describe("buildAuthorViewPrompt", () => {
  it("asks for a Vietnamese reading that separates the author from the interpretation", () => {
    const { system, user } = buildAuthorViewPrompt(ctx, { customInstructions: "", role: "" })
    for (const heading of AUTHOR_HEADINGS) expect(system).toContain(heading)
    expect(system).toContain("Write in Vietnamese")
    expect(system).toContain("Keep established English technical terms")
    expect(system).toContain("Tác giả nói (m:ss)")
    expect(system).toContain("Diễn giải")
    expect(system).toContain("m:ss")
    expect(system).toContain("bằng chứng")
    expect(system).toContain("ý kiến")
    expect(system).toContain("omit or downplay")
    expect(system).toContain("vendor")
    expect(system).toContain("cite the links")
    expect(system).toContain("web search is unavailable")
    expect(system).toContain("software engineer")
    expect(system).not.toContain("Python")
    expect(system).not.toContain("CAIO")
    expect(user).toContain("a queue buffers work")
    expect(user).toContain("[0:00]")
  })

  it("tailors the role section to Vai trò của bạn", () => {
    const { system } = buildAuthorViewPrompt(ctx, {
      customInstructions: "skip the intro",
      role: "AI architect",
    })
    expect(system).toContain("AI architect")
    expect(system).toContain("skip the intro")
    expect(system).not.toContain("software engineer")
    expect(system).not.toContain("Python")
    expect(system).not.toContain("CAIO")
  })
})

describe("buildNodeExplainMessage", () => {
  it("asks for the node's role, neighbors, and timestamps", () => {
    const text = buildNodeExplainMessage("API Gateway", ["API Gateway -- HTTP --> Worker"])
    expect(text).toContain('node "API Gateway"')
    expect(text).toContain("đầu vào và đầu ra")
    expect(text).toContain("thành phần lân cận")
    expect(text).toContain("vì sao nó có mặt")
    expect(text).toContain("mốc thời gian")
    expect(text).toContain("API Gateway -- HTTP --> Worker")
    expect(buildNodeAskDraft("API Gateway", ["API Gateway --> Worker"])).toContain(
      "API Gateway --> Worker",
    )
  })
})

describe("tutorInstructions", () => {
  const tutor = { mode: "explain" as const, level: "engineer" as const }

  it("uses a neutral engineer when the role is empty", () => {
    const text = tutorInstructions(tutor, { role: "  " })
    expect(text).toContain("software engineer")
    expect(text).not.toContain("Python")
    expect(text).not.toContain("CAIO")
  })

  it("uses the saved role and keeps Socratic to one question", () => {
    const text = tutorInstructions({ mode: "socratic", level: "expert" }, { role: "AI architect" })
    expect(text).toContain("AI architect")
    expect(text).toContain("exactly one guiding question")
    expect(text).toContain("strategy view")
    expect(text).not.toContain("Python")
    expect(text).not.toContain("CAIO")
  })
})

describe("selectTranscriptWindow", () => {
  it("keeps segments that overlap ±60s and drops the rest", () => {
    const window = selectTranscriptWindow(ctx.transcript, 60_000)
    expect(window.map((segment) => segment.text)).toEqual([
      "a queue buffers work",
      "backpressure slows producers",
    ])
  })
})

describe("parseConcepts", () => {
  it("reads concept JSON and builds a prerequisite flowchart", () => {
    const parsed = parseConcepts(`\`\`\`json
{"concepts":[
  {"name":"Queue","explanation":"Hàng đợi.","why":"Giảm đột biến.","timestamp":"0:00","related":["Backpressure"],"prerequisites":[]},
  {"name":"Backpressure","explanation":"Hãm người gửi.","why":"Tránh tràn.","timestamp":"0:50","related":["Queue"],"prerequisites":["Queue"]}
]}
\`\`\``)
    expect(parsed?.concepts).toHaveLength(2)
    expect(parsed?.concepts[1]?.prerequisites).toEqual(["Queue"])
    const mermaid = parsed?.mermaid ?? ""
    expect(mermaid).toContain('c0["Queue"]')
    expect(mermaid).toContain('c1["Backpressure"]')
    expect(mermaid).toContain("c0 --> c1")
    expect(conceptMermaid(parsed?.concepts ?? [])).toBe(mermaid)
  })
})

describe("quiz", () => {
  const raw = JSON.stringify({
    questions: [
      {
        id: "q1",
        kind: "choice",
        prompt: "Hàng đợi dùng để làm gì?",
        choices: ["Đệm việc", "Xóa log"],
        answer: 0,
        why: "Nó đệm việc.",
        timestamp: "0:00",
      },
      {
        id: "q2",
        kind: "short",
        prompt: "Backpressure là gì?",
        rubric: "Phải nói tới việc hãm người gửi.",
        why: "Hãm người gửi.",
        timestamp: "0:50",
      },
    ],
  })

  it("parses a mix of choice and short questions", () => {
    const questions = parseQuiz(raw)
    expect(questions?.map((question) => question.kind)).toEqual(["choice", "short"])
    const choice = questions?.[0]
    if (choice?.kind !== "choice") throw new Error("expected a choice")
    expect(gradeChoice(choice, 0)).toBe(true)
    expect(gradeChoice(choice, 1)).toBe(false)
  })

  it("parses short-answer grades", () => {
    expect(
      parseGrades(
        '{"grades":[{"id":"q2","correct":false,"explanation":"Thiếu ý hãm người gửi."}]}',
      ),
    ).toEqual([{ id: "q2", correct: false, explanation: "Thiếu ý hãm người gửi." }])
  })
})

describe("web fallback", () => {
  it("detects a rejected web tool and leaves other errors alone", () => {
    expect(isWebToolRejection(400, "unsupported tool: web_search")).toBe(true)
    expect(isWebToolRejection(404, "gpt-6-luna:online is not a valid model")).toBe(true)
    expect(isWebToolRejection(400, "invalid api key")).toBe(false)
    expect(openRouterOnlineModel("openai/gpt-6-luna")).toBe("openai/gpt-6-luna:online")
    expect(openRouterOnlineModel("openai/gpt-6-luna:online")).toBe("openai/gpt-6-luna:online")
    expect(WEB_NOTE).toBe("không tra web được với provider này")
  })
})
