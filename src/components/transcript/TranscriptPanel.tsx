import { ArrowDown, WarningCircle } from "@phosphor-icons/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useChatDraft } from "@/components/chat/ChatDraftContext"
import { EmptyState } from "@/components/shell/EmptyState"
import { usePanelNav } from "@/components/shell/NavigationContext"
import { useToast } from "@/components/shell/ToastContext"
import { NoCaptions } from "@/components/summary/NoCaptions"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { usePlayer } from "@/hooks/usePlayer"
import { useSeek } from "@/hooks/useSeek"
import { useSettings } from "@/hooks/useSettings"
import type { VideoState } from "@/hooks/useVideo"
import { formatMs } from "@/lib/timestamps"
import { chunkSegments, findActiveIndex } from "@/lib/transcript/parse"
import {
  displayText,
  type TranscriptListItem,
  transcriptToText,
  withChapterHeaders,
} from "@/lib/transcript/text"
import type { Chapter, TranscriptSegment, TranscriptStatus } from "@/lib/types"
import { TranscriptRow } from "./TranscriptRow"
import { TranscriptToolbar } from "./TranscriptToolbar"
import { useTranscriptSearch } from "./useTranscriptSearch"

type ReadyTranscript = Extract<TranscriptStatus, { state: "ready" }>

const NO_CHAPTERS: Chapter[] = []

function TranscriptSkeleton() {
  return (
    <div className="flex flex-col px-[8px] pt-[12px]" aria-busy="true">
      {Array.from({ length: 6 }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
        <div key={i} className="grid grid-cols-[52px_minmax(0,1fr)] gap-[8px] p-[8px]">
          <Skeleton className="mt-[4px] h-[12px] w-[36px]" />
          <div className="flex flex-col gap-[6px] pt-[3px]">
            <Skeleton className="h-[14px] w-full" />
            <Skeleton className="h-[14px] w-2/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function TranscriptPanel({ video, active }: { video: VideoState; active: boolean }) {
  const [settings] = useSettings()
  const { transcript } = video
  switch (transcript.state) {
    case "loading":
      return <TranscriptSkeleton />
    case "unavailable":
      return (
        <div className="px-[16px]">
          <NoCaptions variant="transcript" />
        </div>
      )
    case "error":
      return (
        <EmptyState
          icon={WarningCircle}
          iconWeight="fill"
          title="Couldn't load the transcript"
          description={transcript.message}
          action={
            <Button size="sm" variant="outline" onClick={video.reload}>
              Retry
            </Button>
          }
        />
      )
    case "ready":
      // Wait for stored settings so Follow starts from the saved preference.
      if (!settings) return <TranscriptSkeleton />
      return (
        <TranscriptView
          key={video.videoId ?? ""}
          transcript={transcript}
          chapters={video.page?.chapters ?? NO_CHAPTERS}
          removeFillers={settings.removeFillers}
          initialFollow={settings.followPlayback}
          active={active}
        />
      )
  }
}

interface TranscriptViewProps {
  transcript: ReadyTranscript
  chapters: Chapter[]
  removeFillers: boolean
  initialFollow: boolean
  active: boolean
}

/** Toolbar + list for one video; keyed by video id so search and Follow reset per video. */
function TranscriptView({
  transcript,
  chapters,
  removeFillers,
  initialFollow,
  active,
}: TranscriptViewProps) {
  const [query, setQuery] = useState("")
  const [following, setFollowing] = useState(initialFollow)
  const inputRef = useRef<HTMLInputElement>(null)
  const { selectTab, searchFocusToken } = usePanelNav()
  const { setQuote, requestFocus } = useChatDraft()
  const toast = useToast()
  const seek = useSeek()

  const rows = useMemo<TranscriptSegment[]>(
    () =>
      chunkSegments(transcript.segments).map((row) => ({
        ...row,
        text: displayText(row.text, removeFillers),
      })),
    [transcript.segments, removeFillers],
  )
  const items = useMemo(() => withChapterHeaders(rows, chapters), [rows, chapters])
  const search = useTranscriptSearch(rows, query)
  const matchLabel = search.matches.length ? `${search.index + 1}/${search.matches.length}` : "0/0"

  // Focus the search input on each new request, once this tab is visible.
  const handledFocusToken = useRef(searchFocusToken)
  useEffect(() => {
    if (!active || handledFocusToken.current === searchFocusToken) return
    handledFocusToken.current = searchFocusToken
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [active, searchFocusToken])

  const copy = useCallback(
    (text: string, done: string) => {
      navigator.clipboard.writeText(text).then(
        () => toast(done),
        () => toast("Couldn't copy"),
      )
    },
    [toast],
  )

  const onSeek = useCallback(
    (index: number) => {
      const row = rows[index]
      if (row) seek(row.startMs / 1000)
    },
    [rows, seek],
  )
  const onAsk = useCallback(
    (index: number) => {
      const row = rows[index]
      if (!row) return
      setQuote({ seconds: row.startMs / 1000, text: row.text })
      selectTab("chat")
      requestFocus()
    },
    [rows, setQuote, selectTab, requestFocus],
  )
  const onCopyLine = useCallback(
    (index: number) => {
      const row = rows[index]
      if (row) copy(row.text, "Line copied")
    },
    [rows, copy],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TranscriptToolbar
        query={query}
        onQuery={setQuery}
        matchLabel={matchLabel}
        onNext={search.next}
        onPrev={search.prev}
        onClear={() => {
          setQuery("")
          inputRef.current?.focus()
        }}
        follow={following}
        onToggleFollow={() => setFollowing((f) => !f)}
        onCopy={() => copy(transcriptToText(rows), "Transcript copied with timestamps")}
        inputRef={inputRef}
      />
      <TranscriptList
        rows={rows}
        items={items}
        query={query}
        currentMatch={search.current}
        noMatches={query.trim() !== "" && search.matches.length === 0}
        following={following}
        onFollowingChange={setFollowing}
        active={active}
        onSeek={onSeek}
        onAsk={onAsk}
        onCopyLine={onCopyLine}
      />
    </div>
  )
}

interface TranscriptListProps {
  rows: TranscriptSegment[]
  items: TranscriptListItem<TranscriptSegment>[]
  query: string
  currentMatch: number
  noMatches: boolean
  following: boolean
  onFollowingChange(following: boolean): void
  active: boolean
  onSeek(index: number): void
  onAsk(index: number): void
  onCopyLine(index: number): void
}

/** Scrolls `selector`'s element in `list` to ⅓ from the top. */
function scrollToThird(list: HTMLElement, selector: string, behavior: ScrollBehavior) {
  const el = list.querySelector<HTMLElement>(selector)
  if (el) list.scrollTo({ top: el.offsetTop - list.clientHeight / 3, behavior })
}

/** The only part that re-renders with playback time. */
function TranscriptList({
  rows,
  items,
  query,
  currentMatch,
  noMatches,
  following,
  onFollowingChange,
  active,
  onSeek,
  onAsk,
  onCopyLine,
}: TranscriptListProps) {
  const { ms } = usePlayer()
  const listRef = useRef<HTMLDivElement>(null)
  const wasActive = useRef(false)
  const trimmed = query.trim()
  const searching = trimmed !== ""
  const activeIndex = useMemo(() => findActiveIndex(rows, ms), [rows, ms])

  // Follow: keep the active line ⅓ from the top; jump instantly when the tab was just shown.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-scroll on each active line change
  useEffect(() => {
    const list = listRef.current
    if (!list || !active || !following || searching) return
    scrollToThird(list, '[data-active="true"]', wasActive.current ? "smooth" : "auto")
  }, [active, following, searching, activeIndex])

  // Search: bring the current match ⅓ from the top whenever the query or match changes.
  useEffect(() => {
    const list = listRef.current
    if (!list || !active || !trimmed || currentMatch < 0) return
    scrollToThird(list, '[data-match="true"]', "smooth")
  }, [active, trimmed, currentMatch])

  // Declared last so the effects above still see the previous value.
  useEffect(() => {
    wasActive.current = active
  }, [active])

  const stopFollowing = () => {
    if (following && !searching) onFollowingChange(false)
  }

  const backTo = rows[Math.max(activeIndex, 0)]

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={listRef}
        className="relative min-h-0 flex-1 overflow-y-auto px-[8px] pb-[56px]"
        onWheel={stopFollowing}
        onTouchMove={stopFollowing}
      >
        {items.map((item) =>
          item.kind === "chapter" ? (
            <div
              key={`chapter-${item.chapter.seconds}-${item.chapter.title}`}
              className="flex items-baseline gap-[8px] px-[8px] pt-[16px] pb-[6px]"
            >
              <span className="text-[13px] font-medium text-foreground">{item.chapter.title}</span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {formatMs(item.chapter.seconds * 1000)}
              </span>
            </div>
          ) : (
            <TranscriptRow
              key={item.row.startMs}
              row={item.row}
              index={item.index}
              active={!searching && item.index === activeIndex}
              isMatchCurrent={item.index === currentMatch}
              query={query}
              time={formatMs(item.row.startMs)}
              text={item.row.text}
              onSeek={onSeek}
              onAsk={onAsk}
              onCopy={onCopyLine}
            />
          ),
        )}
        {noMatches ? (
          <p className="px-[16px] py-[40px] text-center text-[14px] text-muted-foreground">
            No matches for “{trimmed}”
          </p>
        ) : null}
      </div>
      {!following && !searching && backTo ? (
        <button
          type="button"
          onClick={() => onFollowingChange(true)}
          className="absolute bottom-[16px] left-1/2 z-10 flex h-[36px] -translate-x-1/2 cursor-pointer items-center gap-[6px] rounded-[8px] bg-primary px-[14px] text-[13px] font-medium whitespace-nowrap text-primary-foreground shadow-pop transition-colors duration-150 outline-none hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <ArrowDown className="size-[14px]" />
          <span>Back to {formatMs(backTo.startMs)}</span>
        </button>
      ) : null}
    </div>
  )
}
