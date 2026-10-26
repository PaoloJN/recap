import type { TranscriptStatus } from "@/lib/types"

export interface TranscriptPanelProps {
  transcript: Extract<TranscriptStatus, { state: "ready" }>
}

export function TranscriptPanel(_props: TranscriptPanelProps) {
  return <p className="p-4 text-sm text-muted-foreground">Transcript coming soon</p>
}
