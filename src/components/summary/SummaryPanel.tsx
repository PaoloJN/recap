import { Square } from "@phosphor-icons/react"
import { Markdown } from "@/components/markdown/Markdown"
import { Button } from "@/components/ui/button"
import type { Settings } from "@/lib/storage"
import type { ModelSelection, VideoContext } from "@/lib/types"
import { useSummary } from "./useSummary"

export interface SummaryPanelProps {
  context: VideoContext
  selection: ModelSelection
  settings: Settings
}

// Placeholder: Task 8 replaces this with the structured summary UI.
export function SummaryPanel({ context, selection, settings }: SummaryPanelProps) {
  const { status, text, error, generate, stop } = useSummary(context, selection, settings, true)

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        {status === "idle" && <Button onClick={() => generate()}>Generate</Button>}
        {status === "streaming" && (
          <Button variant="outline" onClick={stop}>
            <Square weight="fill" />
            Stop
          </Button>
        )}
        {(status === "done" || status === "error") && (
          <Button variant="outline" onClick={() => generate({ force: true })}>
            Regenerate
          </Button>
        )}
      </div>
      {text && <Markdown>{text}</Markdown>}
      {status === "error" && (
        <span role="alert" className="text-sm text-destructive">
          {error}
        </span>
      )}
    </div>
  )
}
