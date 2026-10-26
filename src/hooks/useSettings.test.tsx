import { act } from "react"
import { createRoot } from "react-dom/client"
import { beforeEach, describe, expect, it } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import { type Settings, settingsItem } from "@/lib/storage"
import { useSettings } from "./useSettings"

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

let update: ((patch: Partial<Settings>) => Promise<void>) | undefined

function Probe() {
  update = useSettings()[1]
  return null
}

beforeEach(() => {
  fakeBrowser.reset()
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
})

describe("useSettings", () => {
  it("persists two patches made in the same tick", async () => {
    const root = createRoot(document.createElement("div"))
    await act(async () => root.render(<Probe />))

    await act(async () => {
      await Promise.all([update?.({ theme: "dark" }), update?.({ textSize: "l" })])
    })

    const stored = await settingsItem.getValue()
    expect(stored.theme).toBe("dark")
    expect(stored.textSize).toBe("l")
    act(() => root.unmount())
  })
})
