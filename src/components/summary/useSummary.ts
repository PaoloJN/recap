import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useStorageItem } from "@/hooks/useStorageItem"
import {
  mergeSettings,
  type Settings,
  type StoredSummary,
  summariesItem,
  upsertSummary,
} from "@/lib/storage"
import { type ParsedSummary, parseSummary } from "@/lib/summary/parse"
import { openStream, readTextFromUIStream } from "@/lib/transport"
import type { ModelSelection, SummaryStyle, VideoContext } from "@/lib/types"

export type SummaryStatus = "idle" | "streaming" | "done" | "error"

export interface SummaryState {
  status: SummaryStatus
  text: string
  parsed: ParsedSummary
  receivedFirstToken: boolean
  error: string | null
  style: SummaryStyle
  /** Sets the style and regenerates. */
  setStyle(style: SummaryStyle): void
  stored: StoredSummary | undefined
  feedback: "up" | "down" | undefined
  setFeedback(f: "up" | "down"): void
  generate(opts?: { force?: boolean }): void
  stop(): void
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export function useSummary(
  ctx: VideoContext | null,
  selection: ModelSelection | null,
  rawSettings: Settings,
  enabled: boolean,
): SummaryState {
  // Defensive: saved v2 settings may lack the newer fields.
  const settings = useMemo(() => mergeSettings(rawSettings), [rawSettings])
  const videoId = ctx?.metadata.videoId
  const [store] = useStorageItem(summariesItem)
  const stored = videoId === undefined ? undefined : store?.[videoId]
  const [picked, setPicked] = useState<{ videoId: string; style: SummaryStyle } | null>(null)
  const style: SummaryStyle =
    picked && picked.videoId === videoId ? picked.style : (stored?.style ?? settings.defaultStyle)

  const [status, setStatus] = useState<SummaryStatus>("idle")
  const [liveText, setLiveText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [receivedFirstToken, setReceivedFirstToken] = useState(false)
  const requestRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const autoRef = useRef(new Set<string>())

  const cancel = useCallback(() => {
    requestRef.current++ // make any in-flight request stale
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  // A new video starts clean; anything in flight for the old one is dropped.
  // biome-ignore lint/correctness/useExhaustiveDependencies: videoId is the trigger
  useEffect(() => {
    cancel()
    setStatus("idle")
    setLiveText("")
    setError(null)
    setReceivedFirstToken(false)
  }, [videoId, cancel])

  useEffect(() => cancel, [cancel])

  const run = useCallback(
    (runStyle: SummaryStyle) => {
      if (!ctx || !selection) return
      cancel()
      const request = requestRef.current
      const controller = new AbortController()
      abortRef.current = controller
      const isCurrent = () => request === requestRef.current
      const id = ctx.metadata.videoId

      setStatus("streaming")
      setLiveText("")
      setError(null)
      setReceivedFirstToken(false)

      void (async () => {
        let latest = ""
        // Nothing to show (stopped before any text, or an empty completion): back to idle.
        const settle = (finalText: string) => {
          setLiveText(finalText)
          setStatus(finalText.length > 0 ? "done" : "idle")
        }
        try {
          const stream = openStream(
            {
              kind: "summary",
              style: runStyle,
              context: ctx,
              selection,
              language: settings.language,
              customInstructions: settings.customInstructions,
            },
            { signal: controller.signal },
          )
          const full = await readTextFromUIStream(stream, (partial) => {
            latest = partial
            if (!isCurrent()) return
            setLiveText(partial)
            if (partial.length > 0) setReceivedFirstToken(true)
          })
          if (!isCurrent()) return
          // A stopped (partial) or empty result is never stored.
          if (!controller.signal.aborted && full.length > 0) {
            const current = await summariesItem.getValue()
            await summariesItem.setValue(
              upsertSummary(current, id, {
                style: runStyle,
                model: selection.model,
                language: settings.language === "match" ? ctx.language : settings.language,
                text: full,
                createdAt: Date.now(),
              }),
            )
          }
          if (!isCurrent()) return
          settle(full)
        } catch (err) {
          if (!isCurrent()) return
          if (controller.signal.aborted) {
            settle(latest)
            return
          }
          setError(errorMessage(err))
          setStatus("error")
        } finally {
          if (abortRef.current === controller) abortRef.current = null
        }
      })()
    },
    [ctx, selection, settings.language, settings.customInstructions, cancel],
  )

  const generate = useCallback(
    (opts?: { force?: boolean }) => {
      if (!ctx || !selection) return
      if (!opts?.force && stored) return
      run(style)
    },
    [ctx, selection, stored, style, run],
  )

  const setStyle = useCallback(
    (next: SummaryStyle) => {
      if (videoId === undefined) return
      setPicked({ videoId, style: next })
      run(next)
    },
    [videoId, run],
  )

  const stop = useCallback(() => {
    // Abort without invalidating the request so the reader can deliver the partial text.
    abortRef.current?.abort()
  }, [])

  const setFeedback = useCallback(
    (f: "up" | "down") => {
      if (videoId === undefined) return
      void (async () => {
        const current = await summariesItem.getValue()
        const entry = current[videoId]
        if (entry)
          await summariesItem.setValue({ ...current, [videoId]: { ...entry, feedback: f } })
      })()
    },
    [videoId],
  )

  // Auto-summarize once per video, after the stored cache has loaded.
  useEffect(() => {
    if (!enabled || !settings.autoSummarize || !ctx || !selection) return
    if (store === undefined || stored || status !== "idle") return
    const id = ctx.metadata.videoId
    if (autoRef.current.has(id)) return
    autoRef.current.add(id)
    run(style)
  }, [enabled, settings.autoSummarize, ctx, selection, store, stored, status, style, run])

  const active = Boolean(ctx && selection)
  const restored = active && status === "idle" && stored !== undefined
  const effectiveStatus: SummaryStatus = !active ? "idle" : restored ? "done" : status
  const text = !active ? "" : restored ? (stored?.text ?? "") : liveText
  const parsed = useMemo(
    () => parseSummary(text, { streaming: effectiveStatus === "streaming" }),
    [text, effectiveStatus],
  )

  return {
    status: effectiveStatus,
    text,
    parsed,
    receivedFirstToken,
    error,
    style,
    setStyle,
    stored,
    feedback: stored?.feedback,
    setFeedback,
    generate,
    stop,
  }
}
