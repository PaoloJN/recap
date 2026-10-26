import { Check, Copy, RefreshCw, Sparkles, Square } from "lucide-react"
import { Markdown } from "@/components/markdown/Markdown"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard"
import { SUMMARY_PRESETS } from "@/lib/prompts/presets"
import type { ModelSelection, SummaryStyle, VideoContext } from "@/lib/types"
import { useSummary } from "./useSummary"

export interface SummaryPanelProps {
  context: VideoContext
  selection: ModelSelection
}

const PRESET_IDS = Object.keys(SUMMARY_PRESETS) as SummaryStyle[]

export function SummaryPanel({ context, selection }: SummaryPanelProps) {
  const { status, text, error, preset, setPreset, generate, stop } = useSummary(context, selection)
  const { copied, copy } = useCopyToClipboard()
  const current = SUMMARY_PRESETS[preset]

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <Select value={preset} onValueChange={(v) => setPreset(v as SummaryStyle)}>
          <SelectTrigger className="min-w-0 flex-1" aria-label="Summary type">
            <SelectValue>{current.label}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {PRESET_IDS.map((id) => (
              <SelectItem key={id} value={id}>
                <span className="flex flex-col items-start">
                  <span>{SUMMARY_PRESETS[id].label}</span>
                  <span className="text-xs text-muted-foreground">
                    {SUMMARY_PRESETS[id].description}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {status === "idle" && (
          <Button onClick={() => generate()}>
            <Sparkles />
            Generate
          </Button>
        )}
        {status === "streaming" && (
          <Button variant="outline" onClick={stop}>
            <Square />
            Stop
          </Button>
        )}
        {(status === "done" || status === "error") && (
          <>
            <Button variant="outline" onClick={() => generate({ force: true })}>
              <RefreshCw />
              Regenerate
            </Button>
            {status === "done" && text && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Copy as Markdown"
                      onClick={() => void copy(text)}
                    >
                      {copied ? <Check /> : <Copy />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copy as Markdown</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </>
        )}
      </div>

      {status === "idle" && (
        <p className="text-sm text-muted-foreground">
          Generate a {current.label} for this video. {current.description}
        </p>
      )}
      {status === "streaming" && !text && (
        <div className="flex flex-col gap-2" role="status" aria-label="Generating summary">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      )}
      {text && (status === "streaming" || status === "done") && <Markdown>{text}</Markdown>}
      {status === "error" && (
        <div className="flex items-center justify-between gap-2 text-sm text-destructive">
          <span role="alert">{error}</span>
          <Button variant="outline" size="sm" onClick={() => generate()}>
            Retry
          </Button>
        </div>
      )}
    </div>
  )
}
