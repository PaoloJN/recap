import { describe, expect, it } from "vitest"
import { splitByQuery } from "./highlight"

describe("splitByQuery", () => {
  it("returns one non-match part for an empty query", () => {
    expect(splitByQuery("hello world", "")).toEqual([{ text: "hello world", match: false }])
  })

  it("matches case-insensitively and keeps original casing", () => {
    expect(splitByQuery("Hello World", "world")).toEqual([
      { text: "Hello ", match: false },
      { text: "World", match: true },
    ])
  })

  it("finds multiple matches", () => {
    expect(splitByQuery("a cat and a Cat", "cat")).toEqual([
      { text: "a ", match: false },
      { text: "cat", match: true },
      { text: " and a ", match: false },
      { text: "Cat", match: true },
    ])
  })

  it("returns a single part when the query is longer than the text", () => {
    expect(splitByQuery("hi", "hello there")).toEqual([{ text: "hi", match: false }])
  })
})
