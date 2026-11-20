import { browser } from "wxt/browser"

/**
 * Access and refresh tokens live here, in `chrome.storage.local`, and nowhere else.
 * The content script never imports this module and the values are never sent in a message.
 */
const VAULT_KEY = "chatgptVault"

export interface ChatGptVault {
  hostId: string
  clientId?: string
  idToken?: string
  accessToken?: string
  refreshToken?: string
  expiresAt?: number
  scope?: string
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined
}

export async function loadVault(): Promise<ChatGptVault> {
  const stored = await browser.storage.local.get(VAULT_KEY)
  const raw = stored[VAULT_KEY]
  if (!raw || typeof raw !== "object") return { hostId: "" }
  const vault = raw as Partial<ChatGptVault>
  return {
    hostId: typeof vault.hostId === "string" ? vault.hostId : "",
    clientId: str(vault.clientId),
    idToken: str(vault.idToken),
    accessToken: str(vault.accessToken),
    refreshToken: str(vault.refreshToken),
    expiresAt: typeof vault.expiresAt === "number" ? vault.expiresAt : undefined,
    scope: str(vault.scope),
  }
}

export async function saveVault(vault: ChatGptVault): Promise<void> {
  await browser.storage.local.set({ [VAULT_KEY]: vault })
}

export function vaultIsSignedIn(vault: ChatGptVault): boolean {
  return Boolean(vault.accessToken && vault.refreshToken && vault.clientId)
}

/** Stable per install. Survives sign-out. */
export async function ensureHostId(): Promise<string> {
  const vault = await loadVault()
  if (vault.hostId.startsWith("urn:uuid:")) return vault.hostId
  const hostId = `urn:uuid:${crypto.randomUUID()}`
  await saveVault({ ...vault, hostId })
  return hostId
}
