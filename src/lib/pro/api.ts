import type { ModelMessage } from "ai"
import { proUrl } from "./config"
import type { MeResponse, Pricing, ProErrorCode } from "./types"

export class ProError extends Error {
  readonly code: ProErrorCode
  readonly resetsAt?: string

  constructor(code: ProErrorCode, message: string, resetsAt?: string) {
    super(message)
    this.name = "ProError"
    this.code = code
    if (resetsAt !== undefined) this.resetsAt = resetsAt
  }
}

/** Body of `POST /api/v1/stream` (server contract). */
export interface ProStreamBody {
  kind: "summary" | "chat"
  system: string
  messages: ModelMessage[]
}

const NETWORK_MESSAGE = "Can't reach Recap Pro. Check your connection."

const DEFAULT_MESSAGES: Record<ProErrorCode, string> = {
  bad_request: "Recap Pro couldn't read that request.",
  unauthorized: "You've been signed out of Recap Pro.",
  upgrade_required: "Your Recap Pro trial has ended.",
  too_large: "This request is too large for Recap Pro.",
  limit_reached: "You've reached your Recap Pro limit.",
  rate_limited: "Too many requests. Try again in a moment.",
  model_unavailable: "The model is unavailable right now. Try again shortly.",
  network: NETWORK_MESSAGE,
  internal_error: "Recap Pro hit an error. Try again.",
}

const SERVER_CODES = new Set<string>([
  "bad_request",
  "unauthorized",
  "upgrade_required",
  "too_large",
  "limit_reached",
  "rate_limited",
  "model_unavailable",
  "internal_error",
] satisfies ProErrorCode[])

function codeForStatus(status: number): ProErrorCode {
  switch (status) {
    case 401:
      return "unauthorized"
    case 402:
      return "upgrade_required"
    case 413:
      return "too_large"
    case 429:
      return "rate_limited"
    case 503:
      return "model_unavailable"
    default:
      return "internal_error"
  }
}

/** Maps a non-2xx Pro response to a ProError, by its JSON `error` code or else its status. */
export async function toProError(res: Response): Promise<ProError> {
  let body: unknown = null
  try {
    body = JSON.parse(await res.text())
  } catch {
    // Not JSON (proxy page, empty body): fall back to the status.
  }
  const record = body !== null && typeof body === "object" ? (body as Record<string, unknown>) : {}
  const code =
    typeof record.error === "string" && SERVER_CODES.has(record.error)
      ? (record.error as ProErrorCode)
      : codeForStatus(res.status)
  const message =
    typeof record.message === "string" && record.message.trim() !== ""
      ? record.message
      : DEFAULT_MESSAGES[code]
  const resetsAt = typeof record.resetsAt === "string" ? record.resetsAt : undefined
  return new ProError(code, message, resetsAt)
}

function isAbortError(error: unknown): boolean {
  return (error instanceof DOMException || error instanceof Error) && error.name === "AbortError"
}

/** fetch that maps transport failures to ProError("network") and lets aborts through. */
async function send(fetchImpl: typeof fetch, url: string, init?: RequestInit): Promise<Response> {
  let res: Response
  try {
    res = await fetchImpl(url, init)
  } catch (error) {
    if (isAbortError(error)) throw error
    throw new ProError("network", NETWORK_MESSAGE)
  }
  if (!res.ok) throw await toProError(res)
  return res
}

export async function fetchMe(token: string, fetchImpl: typeof fetch = fetch): Promise<MeResponse> {
  const res = await send(fetchImpl, proUrl("/api/v1/me"), { headers: { "x-api-key": token } })
  return (await res.json()) as MeResponse
}

export async function fetchPricing(fetchImpl: typeof fetch = fetch): Promise<Pricing> {
  const res = await send(fetchImpl, proUrl("/api/v1/pricing"))
  return (await res.json()) as Pricing
}

/** Revokes the device key on the server. Best effort: never throws. */
export async function disconnect(token: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  try {
    await fetchImpl(proUrl("/api/v1/disconnect"), {
      method: "POST",
      headers: { "x-api-key": token },
    })
  } catch {
    // Signing out locally must succeed even when the server can't be reached.
  }
}

/** Starts a Pro stream. Resolves with the SSE response; throws ProError on failure. */
export function streamRequest(
  token: string,
  body: ProStreamBody,
  signal: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  return send(fetchImpl, proUrl("/api/v1/stream"), {
    method: "POST",
    headers: { "x-api-key": token, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  })
}
