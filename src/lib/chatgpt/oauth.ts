import {
  CHATGPT_AGENT_NAME,
  CHATGPT_AUTHORIZE_URL,
  CHATGPT_DIRECT_SCOPE,
  CHATGPT_DYNAMIC_CLIENT_ID,
  CHATGPT_REDIRECT_URI,
  CHATGPT_REFRESH_SKEW_MS,
  CHATGPT_RESOURCE,
  CHATGPT_SCOPE,
} from "./constants"

export function scopeIncludesDirect(scope: string): boolean {
  return scope.split(/\s+/).includes(CHATGPT_DIRECT_SCOPE)
}

export function accessExpiresAt(expiresInSeconds: number, now = Date.now()): number {
  const seconds =
    Number.isFinite(expiresInSeconds) && expiresInSeconds > 0 ? expiresInSeconds : 3600
  return now + seconds * 1000 - CHATGPT_REFRESH_SKEW_MS
}

export interface AuthorizeInput {
  /** Issued `oaiapp_` id. Omit on the first sign-in. */
  issuedClientId?: string
  idToken?: string
  loginHint?: string
  hostId: string
  state: string
  nonce: string
  codeChallenge: string
}

/** First sign-in registers with `dynamic_agent_client`. Later sign-ins reuse the issued id. */
export function buildAuthorizeUrl(input: AuthorizeInput): string {
  const issued = input.issuedClientId?.trim()
  const reauth = Boolean(issued && issued !== CHATGPT_DYNAMIC_CLIENT_ID)
  const params = new URLSearchParams({
    client_id: reauth ? (issued as string) : CHATGPT_DYNAMIC_CLIENT_ID,
    ext_agent_host_id: input.hostId,
    response_type: "code",
    redirect_uri: CHATGPT_REDIRECT_URI,
    resource: CHATGPT_RESOURCE,
    scope: CHATGPT_SCOPE,
    state: input.state,
    nonce: input.nonce,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
  })
  if (!reauth) params.set("agent_name_hint", CHATGPT_AGENT_NAME)
  if (reauth && input.idToken) params.set("id_token_hint", input.idToken)
  if (reauth && input.loginHint) params.set("login_hint", input.loginHint)
  return `${CHATGPT_AUTHORIZE_URL}?${params.toString()}`
}

export type CallbackResult =
  | { ok: true; code: string; clientId: string }
  | { ok: false; message: string }

const STATE_MISMATCH = "Đăng nhập ChatGPT không khớp state. Hãy thử lại."

function issuedClientId(value: string | null | undefined): string | undefined {
  const id = value?.trim()
  if (!id || id === CHATGPT_DYNAMIC_CLIENT_ID) return undefined
  return id
}

/**
 * Read `code` and `state` from the loopback redirect.
 * Prefer the callback's client id. On a re-sign-in the callback may omit it or echo
 * `dynamic_agent_client`; then `fallbackClientId` is the saved issued id.
 */
export function parseAuthCallback(
  rawUrl: string,
  expectedState: string,
  fallbackClientId?: string,
): CallbackResult {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return { ok: false, message: "ChatGPT trả về một địa chỉ đăng nhập không hợp lệ." }
  }
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.port !== "1455") {
    return { ok: false, message: "ChatGPT trả về sai địa chỉ chuyển hướng." }
  }
  if (url.pathname !== "/auth/callback") {
    return { ok: false, message: "ChatGPT trả về sai địa chỉ chuyển hướng." }
  }
  const error = url.searchParams.get("error")
  if (error) {
    const description = url.searchParams.get("error_description")
    return { ok: false, message: description?.trim() || `ChatGPT từ chối đăng nhập (${error}).` }
  }
  if (url.searchParams.get("state") !== expectedState) {
    return { ok: false, message: STATE_MISMATCH }
  }
  const code = url.searchParams.get("code")?.trim()
  if (!code) return { ok: false, message: "ChatGPT không trả mã đăng nhập." }
  const clientId =
    issuedClientId(url.searchParams.get("client_id")) ?? issuedClientId(fallbackClientId)
  if (!clientId) return { ok: false, message: "ChatGPT không trả client id của tài khoản." }
  return { ok: true, code, clientId }
}

/** Read one string claim from a JWT payload. Does not verify the signature. */
export function jwtStringClaim(token: string, claim: string): string | undefined {
  const part = token.split(".")[1]
  if (!part) return undefined
  try {
    const padded = part.replace(/-/g, "+").replace(/_/g, "/")
    const json = JSON.parse(atob(padded)) as Record<string, unknown>
    const value = json[claim]
    return typeof value === "string" && value ? value : undefined
  } catch {
    return undefined
  }
}
