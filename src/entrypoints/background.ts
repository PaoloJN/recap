import { browser } from "wxt/browser"
import { registerStreamPortHandler } from "@/background/stream-handler"
import type { ToggleMessage } from "@/lib/port-protocol"

export default defineBackground(() => {
  registerStreamPortHandler()
  browser.commands.onCommand.addListener(async (command) => {
    if (command !== "toggle-panel") return
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
    if (tab?.id != null) {
      try {
        await browser.tabs.sendMessage(tab.id, { type: "toggle-panel" } satisfies ToggleMessage)
      } catch {
        // no content script on this tab
      }
    }
  })
})
