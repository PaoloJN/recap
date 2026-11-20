import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { getActiveSource } from "@/lib/source/active"
import { readTranscriptCache, writeTranscriptCache } from "@/lib/source/cache"
import { NO_CAPTIONS_MESSAGE, type SourceMeta, type SourceTranscript } from "@/lib/source/types"
import { transcriptCacheItem } from "@/lib/storage"
import type { TranscriptStatus, VideoContext, WatchPageData } from "@/lib/types"

export interface VideoState {
  videoId: string | null
  /** Adapter id: `youtube`, `udemy`, `coursera`, `deeplearning`, or `generic`. */
  siteId: string
  page: WatchPageData | null
  pageError: string | null
  transcript: TranscriptStatus
  context: VideoContext | null
  reload(): void
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function toPage(meta: SourceMeta, site: string): WatchPageData {
  return {
    metadata: {
      videoId: meta.id,
      title: meta.title,
      author: meta.course,
      durationSeconds: meta.durationSeconds,
      description: meta.description,
    },
    captionTracks: meta.hasTranscript === false ? [] : [{ languageCode: "und", name: site }],
    innertube: { client: { clientName: site, clientVersion: "1", hl: "en", gl: "US" } },
    chapters: meta.chapters,
  }
}

function toReady(transcript: SourceTranscript): Extract<TranscriptStatus, { state: "ready" }> {
  return {
    state: "ready",
    segments: transcript.segments.map((segment) => ({
      text: segment.text,
      startMs: Math.round(segment.start * 1000),
      endMs: Math.round(segment.end * 1000),
    })),
    language: transcript.language,
    asr: transcript.isAsr,
  }
}

/** YouTube keeps its English empty state. Other sites show the caption hint. */
export function unavailableTranscript(
  siteId: string,
): Extract<TranscriptStatus, { state: "unavailable" }> {
  if (siteId === "youtube") return { state: "unavailable" }
  return { state: "unavailable", message: NO_CAPTIONS_MESSAGE }
}

/**
 * Loads the active source's metadata on every lecture change. A known-empty caption list
 * (YouTube) is unavailable immediately. Otherwise the transcript is fetched only while
 * `loadTranscript` is true, once per page, and reused from the local cache until reload.
 */
export function useVideo(loadTranscript: boolean): VideoState {
  const [videoId, setVideoId] = useState<string | null>(null)
  const [siteId, setSiteId] = useState(() => getActiveSource().id)
  const [page, setPage] = useState<WatchPageData | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)
  const [transcript, setTranscript] = useState<TranscriptStatus>({ state: "loading" })
  const [reloadKey, setReloadKey] = useState(0)
  const pageRequestRef = useRef(0)
  const transcriptRequestRef = useRef(0)
  const transcriptPageRef = useRef<WatchPageData | null>(null)
  const bypassCache = useRef(false)

  useEffect(() => getActiveSource().onNavigate(setVideoId), [])

  // Effect A: metadata, on every id change (and reload).
  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadKey re-runs the fetch on demand
  useEffect(() => {
    const source = getActiveSource()
    setSiteId(source.id)
    const request = ++pageRequestRef.current
    const isCurrent = () => request === pageRequestRef.current
    transcriptRequestRef.current++
    transcriptPageRef.current = null
    setPage(null)
    setPageError(null)
    setTranscript({ state: "loading" })
    if (!videoId) return
    source.getMeta({ lectureId: videoId, doc: document }).then(
      (meta) => {
        if (!isCurrent()) return
        const next = toPage(meta, source.id)
        setPage(next)
        if (meta.hasTranscript === false) {
          transcriptPageRef.current = next
          setTranscript(unavailableTranscript(source.id))
        }
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
    const source = getActiveSource()
    if (!page || !loadTranscript || transcriptPageRef.current === page) return
    transcriptPageRef.current = page
    const request = ++transcriptRequestRef.current
    const isCurrent = () => request === transcriptRequestRef.current
    const lectureId = page.metadata.videoId
    const skipCache = bypassCache.current
    bypassCache.current = false
    setTranscript({ state: "loading" })
    void (async () => {
      try {
        if (!skipCache) {
          const cached = readTranscriptCache(
            await transcriptCacheItem.getValue(),
            source.id,
            lectureId,
          )
          if (cached && isCurrent()) {
            setTranscript({
              state: "ready",
              segments: cached.segments,
              language: cached.language,
              asr: cached.isAsr,
            })
            return
          }
        }
        if (!isCurrent()) return
        const result = await source.getTranscript({ lectureId, doc: document })
        if (!isCurrent()) return
        if (!result || result.segments.length === 0) {
          setTranscript(unavailableTranscript(source.id))
          return
        }
        const ready = toReady(result)
        if (isCurrent()) setTranscript(ready)
        const store = await transcriptCacheItem.getValue()
        await transcriptCacheItem.setValue(
          writeTranscriptCache(store, {
            site: source.id,
            lectureId,
            segments: ready.segments,
            language: ready.language,
            isAsr: result.isAsr,
            savedAt: Date.now(),
          }),
        )
      } catch (err) {
        if (isCurrent()) setTranscript({ state: "error", message: errorMessage(err) })
      }
    })()
  }, [page, loadTranscript])

  useEffect(
    () => () => {
      pageRequestRef.current++
      transcriptRequestRef.current++
    },
    [],
  )

  const reload = useCallback(() => {
    bypassCache.current = true
    setReloadKey((k) => k + 1)
  }, [])

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

  return { videoId, siteId, page, pageError, transcript, context, reload }
}
