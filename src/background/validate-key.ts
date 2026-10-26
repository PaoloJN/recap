import { browser } from "wxt/browser"
import type { KeyCheckRequest, KeyCheckResult } from "@/lib/port-protocol"
import { PROVIDERS } from "@/lib/providers"
import type { ProviderId } from "@/lib/types"

const OPENROUTER_AUTH_URL = "https://openrouter.ai/api/v1/auth/key"
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models"

interface Endpoint {
  url: string
  headers: (key: string) => Record<string, string>
  models: (body: unknown) => string[]
}

function ids(body: unknown): string[] {
  const data = (body as { data?: Array<{ id?: unknown }> } | null)?.data
  if (!Array.isArray(data)) return []
  return data.map((m) => m?.id).filter((id): id is string => typeof id === "string")
}

const ENDPOINTS: Record<ProviderId, Endpoint> = {
  openai: {
    url: "https://api.openai.com/v1/models",
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
    models: ids,
  },
  anthropic: {
    url: "https://api.anthropic.com/v1/models",
    headers: (key) => ({
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    }),
    models: ids,
  },
  google: {
    url: "https://generativelanguage.googleapis.com/v1beta/models",
    headers: (key) => ({ "x-goog-api-key": key }),
    models: (body) => {
      const list = (body as { models?: Array<{ name?: unknown }> } | null)?.models
      if (!Array.isArray(list)) return []
      return list
        .map((m) => m?.name)
        .filter((n): n is string => typeof n === "string")
        .map((n) => n.replace(/^models\//, ""))
    },
  },
  openrouter: {
    url: OPENROUTER_AUTH_URL,
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
    models: () => [],
  },
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return null
  }
}

export async function validateKey(
  provider: ProviderId,
  key: string,
  fetchFn: typeof fetch = fetch,
): Promise<KeyCheckResult> {
  const { label } = PROVIDERS[provider]
  const endpoint = ENDPOINTS[provider]
  try {
    const res = await fetchFn(endpoint.url, { method: "GET", headers: endpoint.headers(key) })
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        message: `${label} rejected this key (${res.status})`,
      }
    }
    if (provider === "openrouter") {
      try {
        const list = await fetchFn(OPENROUTER_MODELS_URL, { method: "GET" })
        return { ok: true, models: list.ok ? ids(await readJson(list)) : [] }
      } catch {
        return { ok: true, models: [] }
      }
    }
    return { ok: true, models: endpoint.models(await readJson(res)) }
  } catch {
    return { ok: false, status: null, message: `Couldn't reach ${label}. Check your connection.` }
  }
}

export function registerKeyCheckHandler(): void {
  browser.runtime.onMessage.addListener((message: unknown) => {
    const req = message as Partial<KeyCheckRequest> | null
    if (req?.type !== "validate-key" || !req.provider || typeof req.key !== "string") return
    return validateKey(req.provider, req.key)
  })
}
