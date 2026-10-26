import { afterEach, describe, expect, it, vi } from "vitest"
import { getVideoElement, onPlayerState, onTimeUpdate, seekTo } from "./player"

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
  it("onPlayerState reports paused on pause and ms on timeupdate", () => {
    vi.useFakeTimers()
    const cb = vi.fn()
    const off = onPlayerState(cb)
    const v = addVideo()
    vi.advanceTimersByTime(500)
    expect(cb).toHaveBeenLastCalledWith({ ms: 0, paused: true })
    v.currentTime = 2.5
    v.dispatchEvent(new Event("timeupdate"))
    expect(cb).toHaveBeenLastCalledWith({ ms: 2500, paused: true })
    Object.defineProperty(v, "paused", { value: false, configurable: true })
    v.dispatchEvent(new Event("play"))
    expect(cb).toHaveBeenLastCalledWith({ ms: 2500, paused: false })
    Object.defineProperty(v, "paused", { value: true, configurable: true })
    v.dispatchEvent(new Event("pause"))
    expect(cb).toHaveBeenLastCalledWith({ ms: 2500, paused: true })
    v.dispatchEvent(new Event("seeked"))
    const n = cb.mock.calls.length
    off()
    v.dispatchEvent(new Event("pause"))
    expect(cb).toHaveBeenCalledTimes(n)
  })
})
