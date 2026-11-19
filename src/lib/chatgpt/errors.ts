export const CHATGPT_SESSION_EXPIRED = "Phiên ChatGPT đã hết hạn. Hãy đăng nhập lại trong Settings."
export const CHATGPT_NOT_SIGNED_IN = "Chưa đăng nhập ChatGPT."
export const CHATGPT_USAGE_LIMIT =
  "Bạn đã hết hạn mức ChatGPT của gói này. Hạn mức dùng chung với ChatGPT và Codex. Hãy thử lại sau."
export const CHATGPT_USAGE_UNAVAILABLE =
  "ChatGPT tạm thời không cho dùng hạn mức gói đăng ký. Hãy thử lại sau."
export const CHATGPT_INCOMPLETE = "ChatGPT không hoàn tất câu trả lời."

export function friendlyChatGptError(code: string | undefined, status?: number): string {
  if (code === "subscription_sharing_usage_limit_exceeded") return CHATGPT_USAGE_LIMIT
  if (code === "subscription_sharing_usage_unavailable") return CHATGPT_USAGE_UNAVAILABLE
  if (status === 401) return CHATGPT_SESSION_EXPIRED
  if (status === 429) return "ChatGPT đang giới hạn tốc độ. Hãy thử lại sau."
  if (status) return `ChatGPT từ chối yêu cầu (${status}).`
  return CHATGPT_INCOMPLETE
}

export class ChatGptAuthError extends Error {
  readonly code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.name = "ChatGptAuthError"
    this.code = code
  }
}
