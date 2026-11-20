import { browser } from "wxt/browser"
import {
  CHATGPT_DIRECT_SCOPE,
  CHATGPT_DYNAMIC_CLIENT_ID,
  CHATGPT_MODELS_URL,
  CHATGPT_REDIRECT_URI,
  CHATGPT_RESOURCE,
  CHATGPT_TOKEN_URL,
} from "@/lib/chatgpt/constants"
import {
  CHATGPT_NOT_SIGNED_IN,
  CHATGPT_SESSION_EXPIRED,
  ChatGptAuthError,
  friendlyChatGptError,
} from "@/lib/chatgpt/errors"
import { parseChatGptModels } from "@/lib/chatgpt/models"
import {
  accessExpiresAt,
  buildAuthorizeUrl,
  jwtStringClaim,
  parseAuthCallback,
  scopeIncludesDirect,
} from "@/lib/chatgpt/oauth"
import { createPkcePair, randomUrlToken } from "@/lib/chatgpt/pkce"
import type { ChatGptLoginResult, ChatGptModelsResult } from "@/lib/chatgpt/protocol"
import { chatgptSessionItem } from "@/lib/storage"
import {
  type ChatGptVault,
  ensureHostId,
  loadVault,
  saveVault,
  vaultIsSignedIn,
} from "./chatgpt-store"

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000
const REAUTH_CLIENT = "ChatGPT không nhận client id đã lưu. Hãy đăng nhập lại."

interface TokenResponse {
  access_token: string
  refresh_token: string
  id_token?: string
  expires_in: number
  scope: string
}

let loginInFlight = false
let refreshing: Promise<ChatGptVault> | null = null

async function publish(signedIn: boolean, message: string): Promise<void> {
  await chatgptSessionItem.setValue({ signedIn, message })
}

export async function syncChatGptSession(): Promise<void> {
  const vault = await loadVault()
  const signedIn = vaultIsSignedIn(vault)
  const current = await chatgptSessionItem.getValue()
  if (current.signedIn === signedIn) return
  await publish(signedIn, signedIn ? "" : current.message)
}

async function signOut(message: string): Promise<void> {
  const vault = await loadVault()
  await saveVault({ hostId: vault.hostId, clientId: vault.clientId, idToken: vault.idToken })
  await publish(false, message)
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(CHATGPT_TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: new URLSearchParams(body),
  })
  const text = await res.text()
  if (!res.ok) {
    let code: string | undefined
    let detail = ""
    try {
      const json = JSON.parse(text) as {
        error?: { message?: string; code?: string } | string
      }
      if (typeof json.error === "string") {
        code = json.error
        detail = json.error
      } else if (json.error) {
        code = json.error.code
        detail = json.error.message ?? ""
      }
    } catch {
      detail = ""
    }
    throw new ChatGptAuthError(detail || `ChatGPT từ chối token (${res.status}).`, code)
  }
  let json: Partial<TokenResponse>
  try {
    json = JSON.parse(text) as Partial<TokenResponse>
  } catch {
    throw new ChatGptAuthError("ChatGPT trả về token không đọc được.")
  }
  if (!json.access_token || !json.refresh_token) {
    throw new ChatGptAuthError("ChatGPT không trả refresh token.")
  }
  if (!scopeIncludesDirect(json.scope ?? "")) {
    throw new ChatGptAuthError(`ChatGPT không cấp quyền ${CHATGPT_DIRECT_SCOPE}.`)
  }
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    id_token: json.id_token,
    expires_in: typeof json.expires_in === "number" ? json.expires_in : 3600,
    scope: json.scope ?? "",
  }
}

function storeTokens(vault: ChatGptVault, token: TokenResponse, clientId: string): ChatGptVault {
  return {
    hostId: vault.hostId,
    clientId,
    idToken: token.id_token || vault.idToken,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: accessExpiresAt(token.expires_in),
    scope: token.scope,
  }
}

async function refreshVault(vault: ChatGptVault): Promise<ChatGptVault> {
  if (!vault.clientId || !vault.refreshToken) {
    await signOut(CHATGPT_NOT_SIGNED_IN)
    throw new ChatGptAuthError(CHATGPT_NOT_SIGNED_IN)
  }
  try {
    const token = await tokenRequest({
      grant_type: "refresh_token",
      client_id: vault.clientId,
      refresh_token: vault.refreshToken,
      resource: CHATGPT_RESOURCE,
    })
    const next = storeTokens(vault, token, vault.clientId)
    await saveVault(next)
    await publish(true, "")
    return next
  } catch (err) {
    await signOut(CHATGPT_SESSION_EXPIRED)
    if (err instanceof ChatGptAuthError) throw new ChatGptAuthError(CHATGPT_SESSION_EXPIRED)
    throw new ChatGptAuthError(CHATGPT_SESSION_EXPIRED)
  }
}

/** One refresh at a time: the refresh token rotates on every success. */
async function refreshSingleFlight(): Promise<ChatGptVault> {
  if (!refreshing) {
    refreshing = (async () => refreshVault(await loadVault()))().finally(() => {
      refreshing = null
    })
  }
  return refreshing
}

export async function getAccessToken(opts?: { force?: boolean }): Promise<string> {
  const vault = await loadVault()
  if (!vaultIsSignedIn(vault)) throw new ChatGptAuthError(CHATGPT_NOT_SIGNED_IN)
  if (!opts?.force && vault.expiresAt !== undefined && Date.now() < vault.expiresAt) {
    return vault.accessToken as string
  }
  const next = await refreshSingleFlight()
  if (!next.accessToken) throw new ChatGptAuthError(CHATGPT_SESSION_EXPIRED)
  return next.accessToken
}

export async function authorizedFetch(
  url: string,
  init: RequestInit,
  force = false,
): Promise<Response> {
  const token = await getAccessToken({ force })
  const headers = new Headers(init.headers)
  headers.set("Authorization", `Bearer ${token}`)
  const res = await fetch(url, { ...init, headers })
  if (res.status === 401 && !force) {
    await res.body?.cancel().catch(() => {})
    return authorizedFetch(url, init, true)
  }
  if (res.status === 401) await signOut(CHATGPT_SESSION_EXPIRED)
  return res
}

function listenForCallback(): {
  arm(tabId: number): void
  done: Promise<URL>
  cancel: () => void
} {
  let tabId: number | null = null
  let settle: ((value: URL | Error) => void) | undefined
  const done = new Promise<URL>((resolve, reject) => {
    settle = (value) => (value instanceof Error ? reject(value) : resolve(value))
  })
  let settled = false
  const finish = (value: URL | Error) => {
    if (settled) return
    settled = true
    browser.webNavigation.onBeforeNavigate.removeListener(onNav)
    browser.tabs.onRemoved.removeListener(onRemoved)
    clearTimeout(timer)
    settle?.(value)
  }
  const onNav = (details: { tabId: number; url: string }) => {
    if (tabId == null || details.tabId !== tabId) return
    try {
      finish(new URL(details.url))
    } catch (err) {
      finish(err instanceof Error ? err : new Error("ChatGPT trả về một địa chỉ không hợp lệ."))
    }
  }
  const onRemoved = (id: number) => {
    if (id === tabId) finish(new Error("Đã đóng tab đăng nhập."))
  }
  const timer = setTimeout(
    () => finish(new Error("Đăng nhập ChatGPT hết thời gian.")),
    LOGIN_TIMEOUT_MS,
  )
  browser.webNavigation.onBeforeNavigate.addListener(onNav, {
    url: [{ hostEquals: "127.0.0.1", ports: [1455], pathEquals: "/auth/callback" }],
  })
  browser.tabs.onRemoved.addListener(onRemoved)
  return {
    arm(id: number) {
      tabId = id
    },
    done,
    cancel: () => finish(new Error("Đã hủy đăng nhập ChatGPT.")),
  }
}

function warnCallbackParamNames(url: URL): void {
  console.warn("ChatGPT callback query params:", [...url.searchParams.keys()])
}

async function forgetIssuedClient(hostId: string): Promise<void> {
  await saveVault({ hostId })
  await publish(false, REAUTH_CLIENT)
}

async function runLogin(): Promise<void> {
  const vault = await loadVault()
  const savedClientId = vault.clientId
  const reauth = Boolean(savedClientId && savedClientId !== CHATGPT_DYNAMIC_CLIENT_ID)
  const hostId = await ensureHostId()
  const { verifier, challenge } = await createPkcePair()
  const state = randomUrlToken()
  const nonce = randomUrlToken()
  const url = buildAuthorizeUrl({
    issuedClientId: vault.clientId,
    idToken: vault.idToken,
    loginHint: vault.idToken ? jwtStringClaim(vault.idToken, "email") : undefined,
    hostId,
    state,
    nonce,
    codeChallenge: challenge,
  })
  const captured = listenForCallback()
  void captured.done.catch(() => {})
  let tabId: number | undefined
  let callback: URL
  try {
    const tab = await browser.tabs.create({ url })
    if (tab.id == null) throw new ChatGptAuthError("Không mở được tab đăng nhập.")
    tabId = tab.id
    captured.arm(tab.id)
    callback = await captured.done
  } finally {
    captured.cancel()
    if (tabId != null) await browser.tabs.remove(tabId).catch(() => {})
  }
  const parsed = parseAuthCallback(callback.toString(), state, savedClientId)
  if (!parsed.ok) {
    warnCallbackParamNames(callback)
    throw new ChatGptAuthError(parsed.message)
  }
  let token: TokenResponse
  try {
    token = await tokenRequest({
      grant_type: "authorization_code",
      client_id: parsed.clientId,
      code: parsed.code,
      code_verifier: verifier,
      redirect_uri: CHATGPT_REDIRECT_URI,
      resource: CHATGPT_RESOURCE,
    })
  } catch (err) {
    if (reauth && err instanceof ChatGptAuthError && err.code === "invalid_client") {
      await forgetIssuedClient(hostId)
      throw new ChatGptAuthError(REAUTH_CLIENT, "invalid_client")
    }
    throw err
  }
  if (!token.id_token) throw new ChatGptAuthError("ChatGPT không trả id_token.")
  const returnedNonce = jwtStringClaim(token.id_token, "nonce")
  if (returnedNonce && returnedNonce !== nonce) {
    throw new ChatGptAuthError("ChatGPT trả nonce không khớp.")
  }
  const current = await loadVault()
  await saveVault(storeTokens({ ...current, hostId }, token, parsed.clientId))
  await publish(true, "")
}

export async function loginChatGpt(): Promise<ChatGptLoginResult> {
  if (loginInFlight) return { ok: false, message: "Đăng nhập ChatGPT đang mở." }
  loginInFlight = true
  try {
    await runLogin()
    return { ok: true }
  } catch (err) {
    const message =
      err instanceof Error && err.message ? err.message : "Không đăng nhập được ChatGPT."
    const current = await chatgptSessionItem.getValue()
    if (!current.signedIn) await publish(false, message)
    return { ok: false, message }
  } finally {
    loginInFlight = false
  }
}

export async function logoutChatGpt(): Promise<void> {
  await signOut("")
}

async function errorCode(res: Response): Promise<string | undefined> {
  try {
    const json = (await res.json()) as { error?: { code?: string } }
    return json.error?.code
  } catch {
    return undefined
  }
}

export async function listChatGptModels(): Promise<ChatGptModelsResult> {
  try {
    const res = await authorizedFetch(CHATGPT_MODELS_URL, {
      method: "GET",
      headers: { accept: "application/json" },
    })
    if (!res.ok)
      return { ok: false, message: friendlyChatGptError(await errorCode(res), res.status) }
    return { ok: true, models: parseChatGptModels(await res.json()) }
  } catch (err) {
    const message =
      err instanceof Error && err.message ? err.message : "Không lấy được danh sách model."
    return { ok: false, message }
  }
}
