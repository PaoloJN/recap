import { useCallback, useEffect, useRef, useState } from "react"
import { openStream, readTextFromUIStream } from "@/lib/transport"
import type { ModelSelection, SummaryPresetId, VideoContext } from "@/lib/types"
import { summaryCache, summaryCacheKey } from "./summary-cache"

export type SummaryStatus = "idle" | "streaming" | "done" | "error"

export interface SummaryState {
  status: SummaryStatus
  text: string
  error: string | null
  preset: SummaryPresetId
  setPreset(preset: SummaryPresetId): void
  generate(opts?: { force?: boolean }): void
  stop(): void
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export function useSummary(ctx: VideoContext, selection: ModelSelection): SummaryState {
  const [preset, setPreset] = useState<SummaryPresetId>("tldr")
  const [status, setStatus] = useState<SummaryStatus>("idle")
  const [text, setText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const requestRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const videoId = ctx.metadata.videoId

  const cancel = useCallback(() => {
    requestRef.current++ // make any in-flight request stale
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  // Restore from cache (or reset) whenever the video or preset changes; abort anything in flight.
  useEffect(() => {
    cancel()
    const cached = summaryCache.get(summaryCacheKey(videoId, preset))
    setError(null)
    if (cached !== undefined) {
      setText(cached)
      setStatus("done")
    } else {
      setText("")
      setStatus("idle")
    }
  }, [videoId, preset, cancel])

  useEffect(() => cancel, [cancel])

  const generate = useCallback(
    (opts?: { force?: boolean }) => {
      const key = summaryCacheKey(videoId, preset)
      if (opts?.force) summaryCache.delete(key)
      const cached = summaryCache.get(key)
      if (cached !== undefined) {
        cancel()
        setText(cached)
        setError(null)
        setStatus("done")
        return
      }

      cancel()
      const request = requestRef.current
      const controller = new AbortController()
      abortRef.current = controller
      const isCurrent = () => request === requestRef.current

      setStatus("streaming")
      setText("")
      setError(null)

      void (async () => {
        try {
          const stream = openStream(
            { kind: "summary", preset, context: ctx, selection },
            { signal: controller.signal },
          )
          const full = await readTextFromUIStream(stream, (partial) => {
            if (isCurrent()) setText(partial)
          })
          if (!isCurrent()) return
          if (controller.signal.aborted) {
            setText(full)
          } else {
            summaryCache.set(key, full)
            setText(full)
          }
          setStatus("done")
        } catch (err) {
          if (!isCurrent()) return
          if (controller.signal.aborted) {
            setStatus("done")
            return
          }
          setError(errorMessage(err))
          setStatus("error")
        } finally {
          if (abortRef.current === controller) abortRef.current = null
        }
      })()
    },
    [videoId, preset, ctx, selection, cancel],
  )

  const stop = useCallback(() => {
    // Abort without invalidating the request so the reader can deliver the partial text.
    abortRef.current?.abort()
  }, [])

  return { status, text, error, preset, setPreset, generate, stop }
}
