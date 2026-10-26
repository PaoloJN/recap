import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createTrailingThrottle } from "./throttle"

describe("createTrailingThrottle", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("passes the leading call immediately", () => {
    const fn = vi.fn()
    createTrailingThrottle(fn, 250)(1)
    expect(fn).toHaveBeenCalledWith(1)
  })

  it("defers calls inside the window and the last value wins", () => {
    const fn = vi.fn()
    const t = createTrailingThrottle(fn, 250)
    t(1)
    vi.advanceTimersByTime(100)
    t(2)
    t(3)
    expect(fn).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(150)
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenLastCalledWith(3)
  })

  it("cancel drops the pending flush", () => {
    const fn = vi.fn()
    const t = createTrailingThrottle(fn, 250)
    t(1)
    t(2)
    t.cancel()
    vi.advanceTimersByTime(1000)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
