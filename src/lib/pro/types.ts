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
