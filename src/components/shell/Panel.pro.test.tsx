import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import type { VideoState } from "@/hooks/useVideo"

// A Recap Pro build (WXT_PRO_ORIGIN set) with the server faked: counts pricing requests.
const api = vi.hoisted(() => ({
  fetchPricing: vi.fn(async () => ({
    monthly: { display: "$4.99" },
    yearly: { display: "$39.99" },
  })),
}))
vi.mock("@/lib/pro/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pro/api")>()),
  fetchPricing: api.fetchPricing,
}))
// No YouTube page in jsdom: a video with no id and nothing loading.
vi.mock("@/hooks/useVideo", () => ({
  useVideo: (): VideoState => ({
    videoId: null,
    page: null,
    pageError: null,
    transcript: { state: "loading" },
    context: null,
    reload: () => {},
  }),
}))

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

let root: Root | null = null
let el: HTMLDivElement

async function renderApp(tab: "summary" | "chat") {
  act(() => root?.unmount())
  el?.remove()
  vi.stubEnv("WXT_PRO_ORIGIN", "https://recap.test")
  vi.resetModules()
  const { PRO_ENABLED } = await import("@/lib/pro/config")
  expect(PRO_ENABLED).toBe(true)
  const storage = await import("@/lib/storage")
  await storage.panelStateItem.setValue({ open: true, tab })
  const { App } = await import("./App")
  el = document.createElement("div")
  document.body.append(el)
  root = createRoot(el)
  await act(async () => root?.render(<App container={el} />))
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve()
  })
  return storage
}

async function seedSettings(provider: "openai" | "pro", key: string | null) {
  vi.stubEnv("WXT_PRO_ORIGIN", "https://recap.test")
  vi.resetModules()
  const { DEFAULT_SETTINGS, settingsItem, apiKeysItem } = await import("@/lib/storage")
  await settingsItem.setValue({ ...DEFAULT_SETTINGS, provider })
  await apiKeysItem.setValue(key ? { openai: key } : {})
}

beforeEach(() => {
  fakeBrowser.reset()
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  api.fetchPricing.mockClear()
})

afterEach(() => {
  act(() => root?.unmount())
  root = null
  el?.remove()
})

describe("Panel in a Recap Pro build", () => {
  it("never asks the Pro server for pricing when your own key is selected", async () => {
    await seedSettings("openai", "sk-test")
    await renderApp("summary")
    await renderApp("chat")
    const settings = [...el.querySelectorAll("button")].find(
      (b) => b.getAttribute("aria-label") === "Settings" || b.textContent === "Settings",
    )
    expect(settings).toBeDefined()
    await act(async () => settings?.click())
    await act(async () => {
      for (let i = 0; i < 10; i++) await Promise.resolve()
    })
    expect(el.textContent).toContain("Settings")
    expect(api.fetchPricing).not.toHaveBeenCalled()
  })

  it("shows the trial price under the sign-in button when there is no key", async () => {
    await seedSettings("openai", null)
    await renderApp("summary")
    expect(api.fetchPricing).toHaveBeenCalled()
    expect(el.textContent).toContain("Continue with Google")
    expect(el.textContent).toContain("$4.99/month")
  })
})
