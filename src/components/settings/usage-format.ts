import type { MonthUsage } from "@/lib/storage"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** One decimal below 10 of the unit, none at or above it: 1.2k, 41k, 412k, 1.3M. */
function compact(n: number, unit: number, suffix: string): string {
  const oneDecimal = Math.round((n / unit) * 10) / 10
  if (oneDecimal < 10) return `${oneDecimal.toFixed(1).replace(/\.0$/, "")}${suffix}`
  return `${Math.round(n / unit)}${suffix}`
}

export function formatTokens(n: number): string {
  const value = Math.max(0, Math.round(n))
  if (value < 1000) return String(value)
  if (Math.round(value / 1000) < 1000) return compact(value, 1000, "k")
  return compact(value, 1_000_000, "M")
}

export function usageSummaryLine(u: MonthUsage): string {
  const summaries = `${u.summaries} ${u.summaries === 1 ? "summary" : "summaries"}`
  const chats = `${u.chats} ${u.chats === 1 ? "chat" : "chats"}`
  return `${formatTokens(u.tokens)} tokens · ${summaries} · ${chats}`
}

/** "Resets Nov 1": the first day of the month after `now`. */
export function resetsLabel(now: Date): string {
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return `Resets ${MONTHS[next.getMonth()]} 1`
}
