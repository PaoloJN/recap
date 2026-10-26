import type { ModelSelection, VideoContext } from "@/lib/types"

export interface ChatPanelProps {
  context: VideoContext
  selection: ModelSelection
}

export function ChatPanel(_props: ChatPanelProps) {
  return <p className="p-4 text-sm text-muted-foreground">Chat coming soon</p>
}
