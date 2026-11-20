import type { ChatGptModel } from "./models"

export type ChatGptLoginResult = { ok: true } | { ok: false; message: string }

export type ChatGptModelsResult =
  | { ok: true; models: ChatGptModel[] }
  | { ok: false; message: string }

export type ChatGptRuntimeMessage =
  | { type: "chatgpt-login" }
  | { type: "chatgpt-logout" }
  | { type: "chatgpt-models" }

export function isChatGptMessage(message: unknown): message is ChatGptRuntimeMessage {
  const type = (message as { type?: unknown } | null)?.type
  return type === "chatgpt-login" || type === "chatgpt-logout" || type === "chatgpt-models"
}
