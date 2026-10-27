import type { MeResponse, Pricing } from "./types"

function count(n: number): string {
  return n.toLocaleString("en-US")
}

/** "Nov 1": en-US short month and day, in UTC. */
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}

/** One-line plan status, e.g. "Trial · 12 of 20 summaries, 40 of 50 messages left". */
export function planLine(me: MeResponse, now: number): string {
  if (me.plan === "expired") return "Trial ended"
  if (me.plan === "trial") {
    const { summaries, chats, summaryLimit, chatLimit } = me.usage
    const summariesLeft = Math.max(0, summaryLimit - summaries)
    const chatsLeft = Math.max(0, chatLimit - chats)
    return `Trial · ${count(summariesLeft)} of ${count(summaryLimit)} summaries, ${count(chatsLeft)} of ${count(chatLimit)} messages left`
  }
  const end = me.subscription?.currentPeriodEnd ?? null
  // A period end already in the past is stale data (the webhook hasn't landed yet), not a date to show.
  if (end === null || Date.parse(end) <= now) return "Pro"
  return `Pro · ${me.subscription?.cancelAtPeriodEnd ? "ends" : "renews"} ${shortDate(end)}`
}

/** Usage so far, e.g. "12 of 300 summaries · 40 of 1,000 messages · resets Nov 1". */
export function usageLine(me: MeResponse): string {
  const { summaries, chats, summaryLimit, chatLimit, resetsAt } = me.usage
  const used = `${count(summaries)} of ${count(summaryLimit)} summaries · ${count(chats)} of ${count(chatLimit)} messages`
  if (me.plan === "pro" && resetsAt !== null) return `${used} · resets ${shortDate(resetsAt)}`
  return used
}

export function trialPriceLine(pricing: Pricing | null): string {
  const then = pricing ? `${pricing.monthly.display}/month` : "a small monthly plan"
  return `20 free summaries. Then ${then}, cancel anytime.`
}
