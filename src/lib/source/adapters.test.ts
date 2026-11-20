import { describe, expect, it } from "vitest"
import { activeOrGeneric } from "./active"
import { cuesFromCourseraDom, lectureIdFromCoursera } from "./coursera"
import { cuesFromDlaiDom, lectureIdFromDlai } from "./dlai"
import { genericSource } from "./generic"
import { isBuiltinUrl, sourceForUrl } from "./registry"
import { captionsFromUdemyJson, lectureIdFromUdemy } from "./udemy"

/**
 * DOM shapes below follow public page descriptions. They are not captured from a logged-in
 * Udemy, Coursera, or DeepLearning.AI session.
 */

describe("source match", () => {
  it("recognizes the built-in lecture URLs and leaves other sites generic", () => {
    expect(sourceForUrl("https://www.youtube.com/watch?v=abc")?.id).toBe("youtube")
    expect(lectureIdFromUdemy("https://www.udemy.com/course/ml/learn/lecture/12345")).toBe("12345")
    expect(sourceForUrl("https://www.udemy.com/course/ml/learn/lecture/12345")?.id).toBe("udemy")
    expect(lectureIdFromCoursera("https://www.coursera.org/learn/deep-learning/lecture/abcd")).toBe(
      "deep-learning/abcd",
    )
    expect(sourceForUrl("https://www.coursera.org/learn/deep-learning/lecture/abcd")?.id).toBe(
      "coursera",
    )
    expect(lectureIdFromDlai("https://learn.deeplearning.ai/courses/mlops/lesson-1")).toBe(
      "/courses/mlops/lesson-1",
    )
    expect(sourceForUrl("https://learn.deeplearning.ai/courses/mlops/lesson-1")?.id).toBe(
      "deeplearning",
    )
    expect(isBuiltinUrl("https://example.edu/lecture/1")).toBe(false)
    expect(genericSource.match("https://example.edu/lecture/1")).toBe(true)
    expect(activeOrGeneric("https://example.edu/lecture/1", null).id).toBe("generic")
    expect(
      activeOrGeneric(
        "https://www.youtube.com/watch?v=abc",
        sourceForUrl("https://www.youtube.com/watch?v=abc"),
      ).id,
    ).toBe("youtube")
  })

  it("ignores course home pages that are not a lecture", () => {
    expect(lectureIdFromUdemy("https://www.udemy.com/course/ml/")).toBeNull()
    expect(lectureIdFromCoursera("https://www.coursera.org/learn/deep-learning")).toBeNull()
    expect(lectureIdFromDlai("https://learn.deeplearning.ai/")).toBeNull()
    expect(sourceForUrl("https://www.youtube.com/feed/subscriptions")).toBeNull()
  })
})

describe("site fixtures", () => {
  it("reads Udemy caption URLs from embedded lecture JSON", () => {
    const payload = {
      lecture: {
        captions: [
          { url: "https://vtt.udemy.com/en.vtt", locale_id: "en_US", source: "manual" },
          { url: "https://vtt.udemy.com/auto.vtt", locale: "en", source: "auto" },
        ],
      },
    }
    expect(captionsFromUdemyJson(payload)).toEqual([
      { url: "https://vtt.udemy.com/en.vtt", locale: "en_US", auto: false },
      { url: "https://vtt.udemy.com/auto.vtt", locale: "en", auto: true },
    ])
  })

  it("reads Coursera transcript rows", () => {
    document.body.innerHTML = `<div class="rc-Transcript">
      <button data-time="12">The gateway</button>
      <button data-time="28">The worker</button>
    </div>`
    expect(cuesFromCourseraDom(document)).toEqual([
      { start: 12, end: 28, text: "The gateway" },
      { start: 28, end: 33, text: "The worker" },
    ])
    document.body.innerHTML = ""
  })

  it("reads DeepLearning.AI transcript rows", () => {
    document.body.innerHTML = `<div class="transcript-panel">
      <p data-start="4" data-end="9">A layer</p>
    </div>`
    expect(cuesFromDlaiDom(document)).toEqual([{ start: 4, end: 9, text: "A layer" }])
    document.body.innerHTML = ""
  })
})
