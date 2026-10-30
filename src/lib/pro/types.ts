export interface MeResponse {
  user: { email: string; name: string; image: string | null }
  plan: "trial" | "pro" | "expired"
  usage: {
    summaries: number
    chats: number
    summaryLimit: number
    chatLimit: number
    resetsAt: string | null
  }
  subscription: {
    status: string
    currentPeriodEnd: string | null
    cancelAtPeriodEnd: boolean
  } | null
}

export type ProErrorCode =
  | "unauthorized"
  | "upgrade_required"
  | "too_large"
  | "limit_reached"
  | "rate_limited"
  | "model_unavailable"
  | "bad_request"
  | "network"
  | "internal_error"

export interface Pricing {
  monthly: { display: string }
  yearly: { display: string }
}

export interface ProState {
  token: string | null
  me: MeResponse | null
  fetchedAt: number
}

/** `POST /api/v1/link` response. */
export interface LinkStart {
  code: string
  expiresAt: string
}

/** `POST /api/v1/link/claim` outcome; a 410 is `expired`. */
export type LinkClaim =
  | { status: "pending" }
  | { status: "approved"; key: string; finished: boolean }
  | { status: "claimed"; finished: boolean }
  | { status: "expired" }

/** A sign-in in progress, held by the background (`session:proLink`). */
export interface ProLink {
  code: string
  verifier: string
  signInUrl: string
  signInTabId: number | null
  sourceTabId: number | null
  expiresAt: string
  claimed: boolean
}
