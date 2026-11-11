import { browser } from "wxt/browser"
import { UNINSTALL_URL } from "@/lib/site"

export interface InstallDeps {
  openTab: (url: string) => Promise<unknown>
  setUninstallURL: (url: string) => Promise<void>
  welcomeUrl: string
}

/** Opens the welcome page on a fresh install (not on update) and registers the uninstall survey. */
export function registerInstallHandlers(
  deps: InstallDeps = {
    openTab: (url) => browser.tabs.create({ url }),
    setUninstallURL: (url) => browser.runtime.setUninstallURL(url),
    welcomeUrl: browser.runtime.getURL("/welcome.html"),
  },
): void {
  browser.runtime.onInstalled.addListener((details) => {
    if (details.reason !== "install") return
    void deps.openTab(deps.welcomeUrl).catch((e) => console.error("Couldn't open welcome", e))
  })
  void deps.setUninstallURL(UNINSTALL_URL).catch((e) => console.error("Couldn't set uninstall", e))
}
