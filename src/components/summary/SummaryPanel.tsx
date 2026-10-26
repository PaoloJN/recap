import type { ModelSelection, VideoContext } from "@/lib/types"

export interface SummaryPanelProps {
  context: VideoContext
  selection: ModelSelection
}

export function SummaryPanel(_props: SummaryPanelProps) {
  return <p className="p-4 text-sm text-muted-foreground">Summary coming soon</p>
}
