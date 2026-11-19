import { browser } from "wxt/browser"
import { registerChatGptHandler } from "@/background/chatgpt-handler"
import { registerStreamPortHandler } from "@/background/stream-handler"
import { registerKeyCheckHandler } from "@/background/validate-key"
import type { ToggleMessage } from "@/lib/port-protocol"

export default defineBackground(() => {
  registerStreamPortHandler()
  registerKeyCheckHandler()
  registerChatGptHandler()
  browser.commands.onCommand.addListener(async (command) => {
    const type =
      command === "toggle-panel"
        ? "toggle-panel"
        : command === "explain-moment"
          ? "explain-moment"
          : null
    if (!type) return
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
    if (tab?.id != null) {
      try {
        await browser.tabs.sendMessage(tab.id, { type } satisfies ToggleMessage)
      } catch {
        // no content script on this tab
      }
    }
  })
})
