import { browser } from "wxt/browser"
import type { ChatGptLoginResult, ChatGptModelsResult } from "./protocol"

function loginResult(value: unknown): ChatGptLoginResult {
  if (value && typeof value === "object" && "ok" in value) return value as ChatGptLoginResult
  return { ok: false, message: "Không nhận được phản hồi từ extension." }
}

export async function requestChatGptLogin(): Promise<ChatGptLoginResult> {
  return loginResult(await browser.runtime.sendMessage({ type: "chatgpt-login" }))
}

export async function requestChatGptLogout(): Promise<void> {
  await browser.runtime.sendMessage({ type: "chatgpt-logout" })
}

export async function requestChatGptModels(): Promise<ChatGptModelsResult> {
  const value = (await browser.runtime.sendMessage({ type: "chatgpt-models" })) as
    | ChatGptModelsResult
    | undefined
  if (value && typeof value === "object" && "ok" in value) return value
  return { ok: false, message: "Không lấy được danh sách model." }
}
