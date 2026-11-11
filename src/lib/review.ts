import { storage } from "wxt/utils/storage"

export interface ReviewState {
  /** Summaries that finished since install. Stops counting once the prompt is settled. */
  summaries: number
  /** Set once the user rated or dismissed; the prompt never comes back. */
  settled: boolean
}

export const REVIEW_AFTER_SUMMARIES = 3

export const reviewItem = storage.defineItem<ReviewState>("local:review", {
  fallback: { summaries: 0, settled: false },
})

export function countSummary(state: ReviewState): ReviewState {
  if (state.settled) return state
  return { ...state, summaries: Math.min(state.summaries + 1, REVIEW_AFTER_SUMMARIES) }
}

export function shouldAskForReview(state: ReviewState | undefined): boolean {
  if (!state || state.settled) return false
  return state.summaries >= REVIEW_AFTER_SUMMARIES
}

export function settleReview(state: ReviewState): ReviewState {
  return { ...state, settled: true }
}

/** Counts one finished summary toward the review prompt. Never throws. */
export async function recordSummaryForReview(): Promise<void> {
  try {
    const state = await reviewItem.getValue()
    if (state.settled || state.summaries >= REVIEW_AFTER_SUMMARIES) return
    await reviewItem.setValue(countSummary(state))
  } catch (e) {
    console.error("Couldn't count summary for review", e)
  }
}
