import { Sparkle } from "@phosphor-icons/react"
import { estimateLabel } from "@/lib/summary/parse"
import { formatMs } from "@/lib/timestamps"
import { cn } from "@/lib/utils"
import { largeButton, primaryButton, secondaryButton } from "./buttons"

export interface SummaryIdleProps {
  segments: number
  durationSeconds: number
  /** Length of the prompt-formatted transcript, for the time estimate. */
  chars: number
  modelLabel: string
  showAutoHint: boolean
  onGenerate(): void
  onChat(): void
}

export function SummaryIdle({
  segments,
  durationSeconds,
  chars,
  modelLabel,
  showAutoHint,
  onGenerate,
  onChat,
}: SummaryIdleProps) {
  return (
    <div className="flex flex-col gap-[16px] px-[4px] py-[24px]">
      <div className="flex flex-col gap-[6px]">
        <p className="text-[16px] leading-[24px] font-medium text-foreground">
          Summarize this video
        </p>
        <p className="text-[14px] leading-[21px] text-pretty text-muted-foreground">
          {`${segments} transcript segments, ${formatMs(durationSeconds * 1000)} long. Takes about ${estimateLabel(chars)} with ${modelLabel}.`}
        </p>
      </div>
      <div className="flex gap-[8px]">
        <button type="button" className={cn(primaryButton, largeButton)} onClick={onGenerate}>
          <Sparkle weight="fill" aria-hidden />
          Generate summary
        </button>
        <button
          type="button"
          className={cn(secondaryButton, largeButton, "px-[14px]")}
          onClick={onChat}
        >
          Just chat
        </button>
      </div>
      {showAutoHint ? (
        <p className="text-[12px] leading-[16px] text-subtle-foreground">
          Turn on auto-summarize in settings to skip this step.
        </p>
      ) : null}
    </div>
  )
}
