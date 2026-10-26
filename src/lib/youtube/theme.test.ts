import { afterEach, describe, expect, it, vi } from "vitest"
import { getYouTubeTheme, watchYouTubeTheme } from "./theme"

describe("theme", () => {
  afterEach(() => document.documentElement.removeAttribute("dark"))
  it("reads the dark attribute", () => {
    expect(getYouTubeTheme()).toBe("light")
    document.documentElement.setAttribute("dark", "")
    expect(getYouTubeTheme()).toBe("dark")
  })
  it("notifies on change only and disconnects", async () => {
    const cb = vi.fn()
    const off = watchYouTubeTheme(cb)
    document.documentElement.setAttribute("dark", "")
    await vi.waitFor(() => expect(cb).toHaveBeenCalledWith("dark"))
    document.documentElement.setAttribute("dark", "true")
    await new Promise((r) => setTimeout(r, 20))
    expect(cb).toHaveBeenCalledTimes(1)
    document.documentElement.removeAttribute("dark")
    await vi.waitFor(() => expect(cb).toHaveBeenLastCalledWith("light"))
    off()
    document.documentElement.setAttribute("dark", "")
    await new Promise((r) => setTimeout(r, 20))
    expect(cb).toHaveBeenCalledTimes(2)
  })
})
