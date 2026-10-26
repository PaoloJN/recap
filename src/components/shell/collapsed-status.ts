import type { SummaryStyle, TranscriptStatus } from "../../lib/types"
import type { SummaryStatus } from "../summary/useSummary"

export type CollapsedIcon = "key" | "captions" | "warning" | "check" | "spinner" | "sparkle"

export function collapsedStatus(input: {
  hasKey: boolean
  transcript: TranscriptStatus["state"]
  summary: SummaryStatus
  style: SummaryStyle
  momentCount: number
}): { text: string; icon: CollapsedIcon } {
  if (!input.hasKey) return { text: "Add a key to get started", icon: "key" }
  if (input.transcript === "unavailable") {
    return { text: "No captions on this video", icon: "captions" }
  }
  if (input.transcript === "error") {
    return { text: "Couldn't load the transcript", icon: "warning" }
  }
  if (input.summary === "done") {
    const withMoments = input.style !== "tldr" && input.momentCount > 0
    return {
      text: withMoments ? `Summary ready · ${input.momentCount} key moments` : "Summary ready",
      icon: "check",
    }
  }
  if (input.summary === "streaming") return { text: "Summarizing…", icon: "spinner" }
  return { text: "Ready to summarize", icon: "sparkle" }
}
