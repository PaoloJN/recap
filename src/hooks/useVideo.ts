import { useCallback, useEffect, useRef, useState } from "react"
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

export function useVideo(): VideoState {
  const [videoId, setVideoId] = useState<string | null>(null)
  const [page, setPage] = useState<WatchPageData | null>(null)
  const [transcript, setTranscript] = useState<TranscriptStatus>({ state: "loading" })
  const requestRef = useRef(0)

  useEffect(() => onVideoChange(setVideoId), [])

  const load = useCallback(async (id: string | null) => {
    const request = ++requestRef.current
    const isCurrent = () => request === requestRef.current
    setPage(null)
    setTranscript({ state: "loading" })
    if (!id) return
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
    void load(videoId)
    return () => {
      // invalidate any in-flight request for this id
      requestRef.current++
    }
  }, [videoId, load])

  const reload = useCallback(() => {
    void load(videoId)
  }, [load, videoId])

  const context: VideoContext | null =
    page && transcript.state === "ready"
      ? { metadata: page.metadata, transcript: transcript.segments, language: transcript.language }
      : null

  return { videoId, page, transcript, context, reload }
}
