import { afterEach, describe, expect, it, vi } from "vitest"
import { getVideoElement, onTimeUpdate, seekTo } from "./player"

const addVideo = () => {
  const v = document.createElement("video")
  v.className = "html5-main-video"
  document.body.appendChild(v)
  return v
}

describe("player", () => {
  afterEach(() => {
    document.body.innerHTML = ""
    vi.useRealTimers()
  })
  it("finds and seeks the video", () => {
    expect(getVideoElement()).toBeNull()
    const v = addVideo()
    seekTo(42)
    expect(v.currentTime).toBe(42)
  })
  it("emits ms on timeupdate and retries until the element appears", () => {
    vi.useFakeTimers()
    const cb = vi.fn()
    const off = onTimeUpdate(cb)
    const v = addVideo()
    vi.advanceTimersByTime(500)
    v.currentTime = 1.2345
    v.dispatchEvent(new Event("timeupdate"))
    expect(cb).toHaveBeenCalledWith(1235)
    off()
    v.dispatchEvent(new Event("timeupdate"))
    expect(cb).toHaveBeenCalledTimes(1)
  })
})
