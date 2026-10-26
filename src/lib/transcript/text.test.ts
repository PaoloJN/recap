import { describe, expect, it } from "vitest"
import { displayText, stripFillers, transcriptToText, withChapterHeaders } from "./text"

describe("stripFillers", () => {
  it("removes um, uh and you know", () => {
    expect(
      stripFillers("So, um, the idea is simple. And, uh, there's no API, you know, at all."),
    ).toBe("So the idea is simple. And there's no API at all.")
  })
})

describe("displayText", () => {
  it("strips only when enabled", () => {
    expect(displayText("a, um, b", true)).toBe("a b")
    expect(displayText("a, um, b", false)).toBe("a, um, b")
  })
})

describe("withChapterHeaders", () => {
  it("puts a header before the first row at or after each chapter and drops trailing chapters", () => {
    const items = withChapterHeaders(
      [{ startMs: 0 }, { startMs: 60_000 }],
      [
        { seconds: 0, title: "Intro" },
        { seconds: 58, title: "Problem" },
        { seconds: 999, title: "Never" },
      ],
    )
    expect(items.map((i) => i.kind)).toEqual(["chapter", "line", "chapter", "line"])
    expect(items[3]).toEqual({ kind: "line", row: { startMs: 60_000 }, index: 1 })
  })
})

describe("transcriptToText", () => {
  it("renders m:ss text lines", () => {
    expect(
      transcriptToText([
        { startMs: 0, text: "Hi" },
        { startMs: 75_000, text: "There" },
      ]),
    ).toBe("0:00 Hi\n1:15 There")
  })
})
