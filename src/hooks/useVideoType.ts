import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useStorageItem } from "@/hooks/useStorageItem"
import { classifyHeuristic, needsModelCall, parseClassifiedType } from "@/lib/prompts/classify"
import { resolveVideoTypePrompt, type VideoType } from "@/lib/prompts/video-type"
import { type Settings, type StoredVideoType, upsertVideoType, videoTypesItem } from "@/lib/storage"
import { openStream, readTextFromUIStream } from "@/lib/transport"
import type { ModelSelection, VideoContext, WatchPageData } from "@/lib/types"

export interface VideoTypeState {
  /** Null when auto-detect is off and this video has no saved choice. */
  type: VideoType | null
  pending: boolean
  /** False until a cached or freshly decided type is available (or detection is off). */
  ready: boolean
  prompt: string
  setType(type: VideoType): void
}

async function persist(videoId: string, entry: StoredVideoType): Promise<void> {
  const current = await videoTypesItem.getValue()
  if (current[videoId]?.source === "manual") return
  await videoTypesItem.setValue(upsertVideoType(current, videoId, entry))
}

export function useVideoType(input: {
  siteId: string
  page: WatchPageData | null
  context: VideoContext | null
  settings: Settings
  selection: ModelSelection | null
}): VideoTypeState {
  const { siteId, page, context, settings, selection } = input
  const videoId = page?.metadata.videoId ?? null
  const [store] = useStorageItem(videoTypesItem)
  const saved = videoId ? store?.[videoId] : undefined
  const [pending, setPending] = useState(false)
  const asked = useRef(new Set<string>())

  useEffect(() => {
    if (!videoId || !page || store === undefined || store[videoId]) return
    if (!settings.autoDetectVideoType) return
    const guess = classifyHeuristic({
      siteId,
      title: page.metadata.title,
      author: page.metadata.author,
      description: page.metadata.description,
    })
    const transcriptReady = context?.metadata.videoId === videoId
    const ask = needsModelCall(guess.confidence, true, selection !== null) && transcriptReady
    if (!ask) {
      if (guess.confidence === "high" || selection === null) {
        void persist(videoId, { type: guess.type, source: "heuristic" })
      }
      return
    }
    if (asked.current.has(videoId) || !context || !selection) return
    asked.current.add(videoId)
    let cancelled = false
    setPending(true)
    void (async () => {
      let decided = guess.type
      let source: StoredVideoType["source"] = "heuristic"
      try {
        const text = await readTextFromUIStream(
          openStream({
            kind: "classify",
            context,
            selection,
            language: settings.language,
          }),
        )
        const parsed = parseClassifiedType(text)
        if (parsed) {
          decided = parsed
          source = "model"
        }
      } catch {
        // Keep the heuristic guess. A missing key or a refusal should not block the summary.
      }
      if (cancelled) return
      await persist(videoId, { type: decided, source })
      setPending(false)
    })()
    return () => {
      cancelled = true
      asked.current.delete(videoId)
    }
  }, [
    videoId,
    page,
    store,
    siteId,
    context,
    selection,
    settings.autoDetectVideoType,
    settings.language,
  ])

  const guessed = useMemo(() => {
    if (!page || !settings.autoDetectVideoType) return null
    return classifyHeuristic({
      siteId,
      title: page.metadata.title,
      author: page.metadata.author,
      description: page.metadata.description,
    }).type
  }, [page, settings.autoDetectVideoType, siteId])

  const type = saved?.type ?? (settings.autoDetectVideoType ? guessed : null)
  const ready =
    store !== undefined && (saved !== undefined || !settings.autoDetectVideoType || !page)
  const prompt = type ? resolveVideoTypePrompt(type, settings.videoTypePrompts) : ""

  const setType = useCallback(
    (next: VideoType) => {
      if (!videoId) return
      asked.current.add(videoId)
      void (async () => {
        const current = await videoTypesItem.getValue()
        await videoTypesItem.setValue(
          upsertVideoType(current, videoId, { type: next, source: "manual" }),
        )
      })()
    },
    [videoId],
  )

  return { type, pending: pending && saved === undefined, ready, prompt, setType }
}
