import { useMemo } from "react"
import { useSeek } from "@/hooks/useSeek"
import { formatMs } from "@/lib/timestamps"
import type { Chapter } from "@/lib/types"
import { chapterSegments } from "@/lib/youtube/chapters"

export interface ChapterBarProps {
  chapters: Chapter[]
  durationSeconds: number
  ms: number
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

export function ChapterBar({ chapters, durationSeconds, ms }: ChapterBarProps) {
  const seek = useSeek()
  const segments = useMemo(
    () => chapterSegments(chapters, durationSeconds),
    [chapters, durationSeconds],
  )
  const seconds = ms / 1000

  return (
    <div className="flex gap-[3px] px-[16px] pb-[8px]">
      {segments.map((seg) => {
        const label = `${seg.title || "Start"} · ${formatMs(seg.start * 1000)}`
        const fill = clamp01((seconds - seg.start) / (seg.end - seg.start)) * 100
        return (
          <button
            key={seg.start}
            type="button"
            data-chapter
            title={label}
            aria-label={label}
            className="min-w-0 cursor-pointer py-[4px]"
            style={{ flexGrow: seg.end - seg.start, flexShrink: 1, flexBasis: 0 }}
            onClick={() => seek(seg.start)}
          >
            <div className="h-[3px] overflow-hidden rounded-[2px] bg-muted">
              <div data-fill className="h-full bg-progress" style={{ width: `${fill}%` }} />
            </div>
          </button>
        )
      })}
    </div>
  )
}
