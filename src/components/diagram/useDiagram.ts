import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useStorageItem } from "@/hooks/useStorageItem"
import { resolveDiagram } from "@/lib/diagram/assess"
import { parseDiagram, renderDiagram } from "@/lib/diagram/bridge"
import { shortMermaidError } from "@/lib/diagram/parse"
import {
  diagramsItem,
  mergeSettings,
  type Settings,
  type StoredDiagram,
  upsertDiagram,
} from "@/lib/storage"
import { openStream, readTextFromUIStream } from "@/lib/transport"
import type { DiagramLink, ModelSelection, VideoContext } from "@/lib/types"

export type DiagramStatus = "idle" | "streaming" | "fixing" | "done" | "error"

export interface DiagramState {
  status: DiagramStatus
  code: string
  links: DiagramLink[]
  svg: string | null
  /** Short message shown above the raw source. */
  error: string | null
  raw: string
  stored: StoredDiagram | undefined
  /** Without `force`, a no-op when a diagram is stored or a request is already running. */
  generate(opts?: { force?: boolean }): void
  stop(): void
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function stopped(err: unknown, signal: AbortSignal): boolean {
  return signal.aborted || (err instanceof DOMException && err.name === "AbortError")
}

export function useDiagram(
  ctx: VideoContext | null,
  selection: ModelSelection | null,
  rawSettings: Settings,
  dark: boolean,
): DiagramState {
  const settings = useMemo(() => mergeSettings(rawSettings), [rawSettings])
  const videoId = ctx?.metadata.videoId
  const [store] = useStorageItem(diagramsItem)
  const stored = videoId === undefined ? undefined : store?.[videoId]

  const [status, setStatus] = useState<DiagramStatus>("idle")
  const [liveCode, setLiveCode] = useState("")
  const [liveLinks, setLiveLinks] = useState<DiagramLink[]>([])
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [raw, setRaw] = useState("")
  const requestRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  const cancel = useCallback(() => {
    requestRef.current += 1
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: videoId is the trigger
  useEffect(() => {
    cancel()
    setStatus("idle")
    setLiveCode("")
    setLiveLinks([])
    setSvg(null)
    setError(null)
    setRaw("")
  }, [videoId, cancel])

  useEffect(() => cancel, [cancel])

  const run = useCallback(() => {
    if (!ctx || !selection || videoId === undefined) return
    cancel()
    const request = requestRef.current
    const controller = new AbortController()
    abortRef.current = controller
    const isCurrent = () => request === requestRef.current
    const signal = controller.signal

    setStatus("streaming")
    setSvg(null)
    setError(null)
    setRaw("")

    const requestText = async (repair?: { code: string; error: string }) => {
      const stream = openStream(
        {
          kind: "diagram",
          context: ctx,
          selection,
          language: settings.language,
          customInstructions: settings.customInstructions,
          repair,
        },
        { signal },
      )
      return readTextFromUIStream(stream)
    }

    void (async () => {
      try {
        const full = await requestText()
        if (!isCurrent()) return
        if (signal.aborted) {
          setStatus("idle")
          return
        }
        const verdict = await resolveDiagram(full, parseDiagram, async (repair) => {
          if (!isCurrent() || signal.aborted) throw new DOMException("Stopped.", "AbortError")
          setStatus("fixing")
          const fixed = await requestText(repair)
          if (!isCurrent() || signal.aborted) throw new DOMException("Stopped.", "AbortError")
          return fixed
        })
        if (!isCurrent()) return
        if (verdict.status === "invalid") {
          setLiveCode(verdict.code ?? "")
          setLiveLinks([])
          setRaw(verdict.raw)
          setError(shortMermaidError(verdict.message))
          setStatus("error")
          return
        }
        const current = await diagramsItem.getValue()
        await diagramsItem.setValue(
          upsertDiagram(current, videoId, {
            model: selection.model,
            language: settings.language,
            code: verdict.code,
            links: verdict.links,
            createdAt: Date.now(),
          }),
        )
        if (!isCurrent()) return
        setLiveCode(verdict.code)
        setLiveLinks(verdict.links)
        setRaw("")
        setError(null)
        setStatus("done")
      } catch (err) {
        if (!isCurrent()) return
        if (stopped(err, signal)) {
          setStatus("idle")
          return
        }
        setError(errorMessage(err))
        setStatus("error")
      } finally {
        if (abortRef.current === controller) abortRef.current = null
      }
    })()
  }, [ctx, selection, videoId, settings.language, settings.customInstructions, cancel])

  const generate = useCallback(
    (opts?: { force?: boolean }) => {
      if (!ctx || !selection) return
      if (!opts?.force && (stored || abortRef.current)) return
      run()
    },
    [ctx, selection, stored, run],
  )

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const active = Boolean(ctx && selection)
  const restored = active && status === "idle" && stored !== undefined
  const effectiveStatus: DiagramStatus = !active ? "idle" : restored ? "done" : status
  const code = !active
    ? ""
    : restored
      ? (stored?.code ?? "")
      : effectiveStatus === "done" || effectiveStatus === "error"
        ? liveCode
        : ""
  const links = !active ? [] : restored ? (stored?.links ?? []) : liveLinks

  useEffect(() => {
    if (effectiveStatus !== "done" || !code) return
    let cancelled = false
    setSvg(null)
    void renderDiagram(code, dark).then(
      (next) => {
        if (!cancelled) setSvg(next)
      },
      (err) => {
        if (cancelled) return
        // Restored diagrams keep their source in storage, not in liveCode.
        setLiveCode(code)
        setError(errorMessage(err))
        setRaw("")
        setStatus("error")
      },
    )
    return () => {
      cancelled = true
    }
  }, [effectiveStatus, code, dark])

  return {
    status: effectiveStatus,
    code,
    links,
    svg,
    error,
    raw,
    stored,
    generate,
    stop,
  }
}
