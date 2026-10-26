import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { loadTranscript } from "@/lib/transcript/fetch"
import type { TranscriptStatus, VideoContext, WatchPageData } from "@/lib/types"
import { onVideoChange } from "@/lib/youtube/navigation"
import { fetchWatchPage } from "@/lib/youtube/watch-page"

export interface VideoState {
  videoId: string | null
  page: WatchPageData | null
  transcript: TranscriptStatus
  context: VideoContext | null
  reload(): void
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * Tracks the current watch-page video id at all times, but only fetches the watch page and
 * transcript while `enabled` is true. Results are kept per id (collapsing does not discard them);
 * an id change resets to loading without fetching until enabled.
 */
export function useVideo(enabled: boolean): VideoState {
  const [videoId, setVideoId] = useState<string | null>(null)
  const [page, setPage] = useState<WatchPageData | null>(null)
  const [transcript, setTranscript] = useState<TranscriptStatus>({ state: "loading" })
  const requestRef = useRef(0)
  const trackedIdRef = useRef<string | null | undefined>(undefined)
  const loadedIdRef = useRef<string | null>(null)

  useEffect(() => onVideoChange(setVideoId), [])

  const load = useCallback(async (id: string) => {
    const request = ++requestRef.current
    const isCurrent = () => request === requestRef.current
    setPage(null)
    setTranscript({ state: "loading" })
    try {
      const nextPage = await fetchWatchPage(id)
      if (!isCurrent()) return
      setPage(nextPage)
      const nextTranscript = await loadTranscript(nextPage)
      if (isCurrent()) setTranscript(nextTranscript)
    } catch (err) {
      if (isCurrent()) setTranscript({ state: "error", message: errorMessage(err) })
    }
  }, [])

  useEffect(() => {
    if (trackedIdRef.current !== videoId) {
      trackedIdRef.current = videoId
      loadedIdRef.current = null
      requestRef.current++ // drop any in-flight result for the previous id
      setPage(null)
      setTranscript({ state: "loading" })
    }
    if (!enabled || !videoId || loadedIdRef.current === videoId) return
    loadedIdRef.current = videoId
    void load(videoId)
  }, [enabled, videoId, load])

  useEffect(
    () => () => {
      requestRef.current++
    },
    [],
  )

  const reload = useCallback(() => {
    if (!videoId) return
    loadedIdRef.current = videoId
    void load(videoId)
  }, [load, videoId])

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

  return { videoId, page, transcript, context, reload }
}
