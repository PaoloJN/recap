import { afterEach, describe, expect, it, vi } from "vitest"
import { getVideoIdFromUrl, onVideoChange } from "./navigation"

describe("getVideoIdFromUrl", () => {
  it("reads v on /watch", () => {
    expect(getVideoIdFromUrl("https://www.youtube.com/watch?v=abc&t=5")).toBe("abc")
  })
  it("ignores other paths and invalid urls", () => {
    expect(getVideoIdFromUrl("https://www.youtube.com/")).toBeNull()
    expect(getVideoIdFromUrl("https://www.youtube.com/shorts/x")).toBeNull()
    expect(getVideoIdFromUrl("https://www.youtube.com/results?search_query=a")).toBeNull()
    expect(getVideoIdFromUrl("https://www.youtube.com/watch")).toBeNull()
    expect(getVideoIdFromUrl("not a url")).toBeNull()
  })
})

describe("onVideoChange", () => {
  afterEach(() => window.history.pushState({}, "", "/"))
  it("fires on subscribe and once per distinct id", () => {
    window.history.pushState({}, "", "/watch?v=one")
    const cb = vi.fn()
    const off = onVideoChange(cb)
    expect(cb).toHaveBeenLastCalledWith("one")
    document.dispatchEvent(new Event("yt-navigate-finish"))
    expect(cb).toHaveBeenCalledTimes(1)
    window.history.pushState({}, "", "/watch?v=two")
    document.dispatchEvent(new Event("yt-navigate-finish"))
    expect(cb).toHaveBeenCalledTimes(2)
    expect(cb).toHaveBeenLastCalledWith("two")
    window.history.pushState({}, "", "/results?search_query=x")
    document.dispatchEvent(new Event("yt-navigate-finish"))
    expect(cb).toHaveBeenLastCalledWith(null)
    document.dispatchEvent(new Event("yt-navigate-finish"))
    expect(cb).toHaveBeenCalledTimes(3)
    off()
    window.history.pushState({}, "", "/watch?v=three")
    document.dispatchEvent(new Event("yt-navigate-finish"))
    expect(cb).toHaveBeenCalledTimes(3)
  })
})
