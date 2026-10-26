import { Check, Circle, CircleNotch } from "@phosphor-icons/react"

export interface SummaryLoadingProps {
  /** 0 fetching the transcript, 1 reading it (waiting on the first token), 2 writing. */
  step: 0 | 1 | 2
  segmentCount: number
}

/** Width, height and extra top margin of each skeleton bar (prototype). */
const BARS: [string, number, number][] = [
  ["72px", 10, 0],
  ["100%", 12, 6],
  ["94%", 12, 0],
  ["66%", 12, 0],
  ["96px", 10, 20],
  ["90%", 12, 8],
  ["82%", 12, 8],
  ["74%", 12, 8],
  ["66%", 12, 8],
]

export function SummaryLoading({ step, segmentCount }: SummaryLoadingProps) {
  const labels = [
    "Fetching transcript",
    segmentCount > 0 ? `Reading ${segmentCount} segments` : "Reading segments",
    "Writing summary",
  ]
  return (
    <div className="flex flex-col gap-[24px]" aria-busy="true">
      <ol className="flex flex-col gap-[12px] rounded-[12px] border bg-card px-[16px] py-[14px]">
        {labels.map((label, i) => {
          const done = i < step
          const active = i === step
          return (
            <li
              key={label}
              aria-current={active ? "step" : undefined}
              className="flex items-center gap-[10px] text-[13px] leading-[18px]"
            >
              <span className="flex size-[16px] items-center justify-center" aria-hidden>
                {done ? (
                  <Check weight="bold" className="size-[14px] text-success" />
                ) : active ? (
                  <CircleNotch className="size-[14px] animate-spin text-foreground" />
                ) : (
                  <Circle className="size-[14px] text-subtle-foreground" />
                )}
              </span>
              <span className={done || active ? "text-foreground" : "text-subtle-foreground"}>
                {label}
              </span>
            </li>
          )
        })}
      </ol>
      <div className="flex flex-col gap-[8px]" aria-hidden>
        {BARS.map(([width, height, marginTop], i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: static list
            key={i}
            className="rounded-[4px] bg-secondary"
            style={{
              width,
              height,
              marginTop,
              animation: "yt-pulse 1.4s infinite var(--ease-out)",
            }}
          />
        ))}
      </div>
    </div>
  )
}
