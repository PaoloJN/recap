import { beforeEach, describe, expect, it, vi } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import { registerInstallHandlers } from "./install"

function setup() {
  const deps = {
    openTab: vi.fn(async () => undefined),
    setUninstallURL: vi.fn(async () => undefined),
    welcomeUrl: "chrome-extension://id/welcome.html",
  }
  registerInstallHandlers(deps)
  return deps
}

describe("registerInstallHandlers", () => {
  beforeEach(() => fakeBrowser.reset())

  it("sets the uninstall survey URL right away", () => {
    const deps = setup()
    expect(deps.setUninstallURL).toHaveBeenCalledWith("https://recapai.dev/uninstalled")
  })

  it("opens the welcome page on a fresh install", async () => {
    const deps = setup()
    await fakeBrowser.runtime.onInstalled.trigger({ reason: "install" })
    expect(deps.openTab).toHaveBeenCalledWith("chrome-extension://id/welcome.html")
  })

  it("stays quiet on update and browser update", async () => {
    const deps = setup()
    await fakeBrowser.runtime.onInstalled.trigger({ reason: "update", previousVersion: "2.0.0" })
    await fakeBrowser.runtime.onInstalled.trigger({ reason: "chrome_update" })
    expect(deps.openTab).not.toHaveBeenCalled()
  })
})
