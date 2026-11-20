import { browser } from "wxt/browser"
import { registerChatGptHandler } from "@/background/chatgpt-handler"
import { deliverCommand, syncGrantedOrigins } from "@/background/site-access"
import { registerStreamPortHandler } from "@/background/stream-handler"
import { registerKeyCheckHandler } from "@/background/validate-key"
import type { ToggleCommand } from "@/lib/source/access"

function commandOf(command: string): ToggleCommand | null {
  if (command === "toggle-panel" || command === "explain-moment" || command === "focus-mode") {
    return command
  }
  return null
}

export default defineBackground(() => {
  registerStreamPortHandler()
  registerKeyCheckHandler()
  registerChatGptHandler()
  void syncGrantedOrigins()

  browser.commands.onCommand.addListener((command) => {
    const type = commandOf(command)
    if (!type) return
    void browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      void deliverCommand(tab?.id, tab?.url, type)
    })
  })

  browser.action.onClicked.addListener((tab) => {
    void deliverCommand(tab.id, tab.url, "toggle-panel")
  })
})
