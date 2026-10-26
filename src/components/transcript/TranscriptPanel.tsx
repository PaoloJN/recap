import { ArrowDownToLine, Check, Copy, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { TranscriptRow } from "@/components/transcript/TranscriptRow"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard"
import { usePlaybackMs } from "@/hooks/usePlaybackMs"
import { formatMs } from "@/lib/timestamps"
import { chunkSegments, filterSegments, findActiveIndex } from "@/lib/transcript/parse"
import type { TranscriptStatus } from "@/lib/types"
import { seekTo } from "@/lib/youtube/player"

export interface TranscriptPanelProps {
  transcript: Extract<TranscriptStatus, { state: "ready" }>
}

export function TranscriptPanel({ transcript }: TranscriptPanelProps) {
  const [query, setQuery] = useState("")
  const [following, setFollowing] = useState(true)
  const { copied, copy } = useCopyToClipboard()
  const playbackMs = usePlaybackMs()
  const rowRefs = useRef(new Map<number, HTMLButtonElement>())
  const listRef = useRef<HTMLDivElement>(null)

  const rows = useMemo(() => chunkSegments(transcript.segments), [transcript.segments])
  const visible = useMemo(() => filterSegments(rows, query), [rows, query])
  const activeIndex = useMemo(() => findActiveIndex(rows, playbackMs), [rows, playbackMs])
  const searching = query.trim() !== ""

  const scrollToActive = useCallback(() => {
    const list = listRef.current
    const el = rowRefs.current.get(activeIndex)
    if (!list || !el) return
    list.scrollTo({
      top: el.offsetTop - list.clientHeight / 2 + el.clientHeight / 2,
      behavior: "smooth",
    })
  }, [activeIndex])

  useEffect(() => {
    if (following && !searching) scrollToActive()
  }, [following, searching, scrollToActive])

  const stopFollowing = () => setFollowing(false)

  const jumpToCurrent = () => {
    setFollowing(true)
    scrollToActive()
  }

  const copyAll = () => copy(rows.map((row) => `[${formatMs(row.startMs)}] ${row.text}`).join("\n"))

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b p-2">
        <div className="relative flex-1">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search transcript"
            aria-label="Search transcript"
            className="h-8 pr-8 text-sm"
          />
          {query ? (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Clear search"
              className="absolute top-1 right-1"
              onClick={() => setQuery("")}
            >
              <X />
            </Button>
          ) : null}
        </div>
        <Badge variant="secondary">{transcript.language.toUpperCase()}</Badge>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Copy transcript" onClick={copyAll}>
              {copied ? <Check /> : <Copy />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Copy transcript</TooltipContent>
        </Tooltip>
      </div>
      <div className="relative min-h-0 flex-1">
        <div
          ref={listRef}
          className="relative max-h-[440px] overflow-y-auto p-1"
          onWheel={stopFollowing}
          onTouchMove={stopFollowing}
        >
          {visible.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              No matches for “{query.trim()}”
            </p>
          ) : (
            visible.map((row) => {
              const index = rows.indexOf(row)
              return (
                <TranscriptRow
                  key={row.startMs}
                  ref={(el) => {
                    if (el) rowRefs.current.set(index, el)
                    else rowRefs.current.delete(index)
                  }}
                  segment={row}
                  query={query}
                  active={index === activeIndex}
                  onSeek={seekTo}
                />
              )
            })
          )}
        </div>
        {!following && !searching ? (
          <Button
            size="sm"
            variant="secondary"
            className="absolute right-3 bottom-3 shadow-md"
            onClick={jumpToCurrent}
          >
            <ArrowDownToLine />
            Jump to current
          </Button>
        ) : null}
      </div>
    </div>
  )
}
