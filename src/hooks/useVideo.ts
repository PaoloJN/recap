import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { loadTranscript as fetchTranscript } from "@/lib/transcript/fetch"
import type { TranscriptStatus, VideoContext, WatchPageData } from "@/lib/types"
import { onVideoChange } from "@/lib/youtube/navigation"
import { fetchWatchPage } from "@/lib/youtube/watch-page"

export interface VideoState {
  videoId: string | null
  page: WatchPageData | null
  pageError: string | null
  transcript: TranscriptStatus
  context: VideoContext | null
  reload(): void
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * Fetches the watch page on every video id change (chapters, metadata). The transcript is fetched
 * only while `loadTranscript` is true, once per page; no caption tracks means unavailable.
 */
export function useVideo(loadTranscript: boolean): VideoState {
  const [videoId, setVideoId] = useState<string | null>(null)
  const [page, setPage] = useState<WatchPageData | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)
  const [transcript, setTranscript] = useState<TranscriptStatus>({ state: "loading" })
  const [reloadKey, setReloadKey] = useState(0)
  const pageRequestRef = useRef(0)
  const transcriptRequestRef = useRef(0)
  const transcriptPageRef = useRef<WatchPageData | null>(null)

  useEffect(() => onVideoChange(setVideoId), [])

  // Effect A: watch page, on every id change (and reload).
  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadKey re-runs the fetch on demand
  useEffect(() => {
    const request = ++pageRequestRef.current
    const isCurrent = () => request === pageRequestRef.current
    transcriptRequestRef.current++
    transcriptPageRef.current = null
    setPage(null)
    setPageError(null)
    setTranscript({ state: "loading" })
    if (!videoId) return
    fetchWatchPage(videoId).then(
      (next) => {
        if (isCurrent()) setPage(next)
      },
      (err) => {
        if (isCurrent()) setPageError(errorMessage(err))
      },
    )
    return () => {
      pageRequestRef.current++
    }
  }, [videoId, reloadKey])

  // Effect B: transcript, once per page, only while requested.
  useEffect(() => {
    if (!page || !loadTranscript || transcriptPageRef.current === page) return
    transcriptPageRef.current = page
    const request = ++transcriptRequestRef.current
    const isCurrent = () => request === transcriptRequestRef.current
    if (page.captionTracks.length === 0) {
      setTranscript({ state: "unavailable" })
      return
    }
    setTranscript({ state: "loading" })
    fetchTranscript(page).then(
      (next) => {
        if (isCurrent()) setTranscript(next)
      },
      (err) => {
        if (isCurrent()) setTranscript({ state: "error", message: errorMessage(err) })
      },
    )
  }, [page, loadTranscript])

  useEffect(
    () => () => {
      pageRequestRef.current++
      transcriptRequestRef.current++
    },
    [],
  )

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  const context = useMemo<VideoContext | null>(
    () =>
      page && transcript.state === "ready"
        ? {
            metadata: page.metadata,
            transcript: transcript.segments,
            language: transcript.language,
          }
        : null,
    [page, transcript],
  )

  return { videoId, page, pageError, transcript, context, reload }
}
