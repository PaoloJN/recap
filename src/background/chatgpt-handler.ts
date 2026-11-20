import { browser } from "wxt/browser"
import { isChatGptMessage } from "@/lib/chatgpt/protocol"
import { listChatGptModels, loginChatGpt, logoutChatGpt, syncChatGptSession } from "./chatgpt-auth"

export function registerChatGptHandler(): void {
  void syncChatGptSession()
  browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!isChatGptMessage(message)) return undefined
    if (message.type === "chatgpt-login") {
      void loginChatGpt().then(sendResponse)
      return true
    }
    if (message.type === "chatgpt-logout") {
      void logoutChatGpt().then(() => sendResponse({ ok: true }))
      return true
    }
    void listChatGptModels().then(sendResponse)
    return true
  })
}
