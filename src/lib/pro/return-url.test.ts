import { afterEach, describe, expect, it } from "vitest"
import { connectPath, currentReturnUrl } from "./return-url"

function page(href: string, currentTime: number | null): { href: string; doc: Document } {
  const doc = document.implementation.createHTMLDocument()
  if (currentTime !== null) {
    const video = doc.createElement("video")
    video.className = "html5-main-video"
    Object.defineProperty(video, "currentTime", { value: currentTime })
    doc.body.append(video)
  }
  return { href, doc }
}

describe("currentReturnUrl", () => {
  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("keeps only the video id of a watch URL and adds the whole seconds played", () => {
    const { href, doc } = page("https://www.youtube.com/watch?v=abc123&list=PL1&index=2", 75.9)
    expect(currentReturnUrl(href, doc)).toBe("https://www.youtube.com/watch?v=abc123&t=75")
  })

  it("leaves out t at the start of the video or without a player", () => {
    const start = page("https://www.youtube.com/watch?v=abc123", 0.4)
    expect(currentReturnUrl(start.href, start.doc)).toBe("https://www.youtube.com/watch?v=abc123")
    const none = page("https://www.youtube.com/watch?v=abc123", null)
    expect(currentReturnUrl(none.href, none.doc)).toBe("https://www.youtube.com/watch?v=abc123")
  })

  it("keeps a shorts path and drops its query", () => {
    const { href, doc } = page("https://www.youtube.com/shorts/xyz789?feature=share", 12.2)
    expect(currentReturnUrl(href, doc)).toBe("https://www.youtube.com/shorts/xyz789?t=12")
  })

  it("is null off a video page", () => {
    for (const href of [
      "https://www.youtube.com/",
      "https://www.youtube.com/results?search_query=x",
      "https://www.youtube.com/watch",
      "https://www.youtube.com/shorts/",
    ]) {
      const p = page(href, 30)
      expect(currentReturnUrl(p.href, p.doc)).toBeNull()
    }
  })

  it("reads the current page by default", () => {
    expect(currentReturnUrl()).toBeNull()
  })
})

describe("connectPath", () => {
  it("passes the video as return, or nothing without one", () => {
    expect(connectPath("https://www.youtube.com/watch?v=a&t=5")).toBe(
      "/connect?return=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Da%26t%3D5",
    )
    expect(connectPath(null)).toBe("/connect")
  })
})
