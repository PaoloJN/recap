import { ClosedCaptioning } from "@phosphor-icons/react"

const COPY = {
  summary: "This video has no captions",
  transcript: "No captions on this video",
} as const

const BODY =
  "Summaries and chat need captions. Search, follow and jump still work on videos that have them."

export function NoCaptions({ variant }: { variant: "summary" | "transcript" }) {
  return (
    <div className="flex flex-col gap-[16px] px-[4px] py-[24px]">
      <div className="flex size-[44px] items-center justify-center rounded-[12px] bg-secondary text-foreground">
        <ClosedCaptioning className="size-[22px]" aria-hidden />
      </div>
      <div className="flex flex-col gap-[6px]">
        <p className="text-[16px] leading-[24px] font-medium text-foreground">{COPY[variant]}</p>
        <p className="text-[14px] leading-[21px] text-pretty text-muted-foreground">{BODY}</p>
      </div>
    </div>
  )
}
