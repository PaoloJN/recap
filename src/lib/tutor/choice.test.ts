import { describe, expect, it } from "vitest"
import { defaultTutorMode, tutorChoice } from "./choice"

describe("tutorChoice", () => {
  it("picks a mode from the video type", () => {
    expect(defaultTutorMode("course-lecture")).toBe("explain")
    expect(defaultTutorMode("tutorial")).toBe("qa")
    expect(defaultTutorMode("strategy-talk")).toBe("socratic")
    expect(defaultTutorMode("product-demo")).toBe("qa")
    expect(defaultTutorMode("news-analysis")).toBe("qa")
    expect(tutorChoice(null, {}).mode).toBe("qa")
  })

  it("keeps the last choice saved for that type", () => {
    const saved = {
      "course-lecture": { mode: "socratic" as const, level: "expert" as const },
    }
    expect(tutorChoice("course-lecture", saved)).toEqual({ mode: "socratic", level: "expert" })
    expect(tutorChoice("tutorial", saved)).toEqual({ mode: "qa", level: "engineer" })
  })
})
