import type { SummaryStyle } from "@/lib/types"

export interface SummaryStyleInfo {
  id: SummaryStyle
  label: string
  note: string
}

export const SUMMARY_STYLES: Record<SummaryStyle, SummaryStyleInfo> = {
  detailed: { id: "detailed", label: "Detailed", note: "Summary, moments, notes" },
  tldr: { id: "tldr", label: "TL;DR", note: "2–3 sentences" },
  moments: { id: "moments", label: "Key moments", note: "Timestamped outline" },
}

export const SUMMARY_STYLE_IDS = Object.keys(SUMMARY_STYLES) as SummaryStyle[]
