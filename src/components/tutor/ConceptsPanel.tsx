import { useCallback, useEffect, useRef, useState } from "react"
import { useChatDraft } from "@/components/chat/ChatDraftContext"
import { DiagramSvg } from "@/components/diagram/DiagramPanel"
import { usePanelNav } from "@/components/shell/NavigationContext"
import {
  largeButton,
  primaryButton,
  secondaryButton,
  smallButton,
} from "@/components/summary/buttons"
import { AuthorView } from "@/components/tutor/AuthorView"
import { useSeek } from "@/hooks/useSeek"
import { useStorageItem } from "@/hooks/useStorageItem"
import { useTheme } from "@/hooks/useTheme"
import { renderDiagram } from "@/lib/diagram/bridge"
import type { Settings } from "@/lib/storage"
import { conceptsItem, upsertConcepts } from "@/lib/storage"
import { formatMs } from "@/lib/timestamps"
import { openStream, readTextFromUIStream } from "@/lib/transport"
import { parseConcepts } from "@/lib/tutor/concepts"
import { buildDeeperMessage, buildTeachMessage } from "@/lib/tutor/prompts"
import type { Concept } from "@/lib/tutor/types"
import type { ModelSelection, VideoContext } from "@/lib/types"
import { cn } from "@/lib/utils"

type Status = "idle" | "streaming" | "done" | "error"

export function ConceptsPanel({
  ctx,
  selection,
  settings,
}: {
  ctx: VideoContext
  selection: ModelSelection
  settings: Settings
}) {
  const videoId = ctx.metadata.videoId
  const [store] = useStorageItem(conceptsItem)
  const stored = store?.[videoId]
  const [status, setStatus] = useState<Status>("idle")
  const [concepts, setConcepts] = useState<Concept[]>([])
  const [mermaid, setMermaid] = useState("")
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const requestRef = useRef(0)
  const theme = useTheme()
  const dark = settings.theme === "youtube" ? theme === "dark" : settings.theme === "dark"
  const seek = useSeek()
  const { requestAsk } = useChatDraft()
  const { selectTab } = usePanelNav()

  // biome-ignore lint/correctness/useExhaustiveDependencies: videoId is the trigger
  useEffect(() => {
    requestRef.current += 1
    abortRef.current?.abort()
    setStatus("idle")
    setConcepts([])
    setMermaid("")
    setSvg(null)
    setError(null)
  }, [videoId])

  const shown = status === "idle" && stored ? stored.concepts : concepts
  const code = status === "idle" && stored ? stored.mermaid : mermaid
  const visible = status === "done" || (status === "idle" && stored !== undefined)

  useEffect(() => {
    if (!visible || !code) return
    let cancelled = false
    setSvg(null)
    void renderDiagram(code, dark).then(
      (next) => {
        if (!cancelled) setSvg(next)
      },
      (err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Không vẽ được sơ đồ.")
      },
    )
    return () => {
      cancelled = true
    }
  }, [visible, code, dark])

  const generate = useCallback(() => {
    requestRef.current += 1
    const request = requestRef.current
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setStatus("streaming")
    setError(null)
    setSvg(null)
    void (async () => {
      try {
        const stream = openStream(
          {
            kind: "concepts",
            context: ctx,
            selection,
            language: settings.language,
            customInstructions: settings.customInstructions,
            tutor: { mode: settings.tutorMode, level: settings.tutorLevel },
            role: settings.role,
            reasoningEffort: settings.reasoningEffort,
          },
          { signal: controller.signal },
        )
        const text = await readTextFromUIStream(stream)
        if (request !== requestRef.current) return
        const parsed = parseConcepts(text)
        if (!parsed) {
          setError("Không đọc được danh sách khái niệm.")
          setMermaid("")
          setStatus("error")
          return
        }
        setConcepts(parsed.concepts)
        setMermaid(parsed.mermaid)
        const current = await conceptsItem.getValue()
        await conceptsItem.setValue(
          upsertConcepts(current, videoId, {
            model: selection.model,
            language: settings.language,
            concepts: parsed.concepts,
            mermaid: parsed.mermaid,
            createdAt: Date.now(),
          }),
        )
        if (request !== requestRef.current) return
        setStatus("done")
      } catch (err) {
        if (request !== requestRef.current || controller.signal.aborted) return
        setError(err instanceof Error ? err.message : "Không trích được khái niệm.")
        setStatus("error")
      }
    })()
  }, [ctx, selection, settings, videoId])

  const teach = (concept: Concept, web: boolean) => {
    const text = web ? buildDeeperMessage(concept.name) : buildTeachMessage(concept.name)
    requestAsk(videoId, text, web)
    selectTab("chat")
  }

  return (
    <div className="flex flex-col gap-[16px] p-[16px]">
      <div className="flex flex-wrap items-center gap-[8px]">
        <button
          type="button"
          className={cn(primaryButton, largeButton)}
          disabled={status === "streaming"}
          onClick={generate}
        >
          {status === "streaming" ? "Đang trích…" : "Trích khái niệm"}
        </button>
        {status === "streaming" ? (
          <button
            type="button"
            className={cn(secondaryButton, smallButton)}
            onClick={() => abortRef.current?.abort()}
          >
            Dừng
          </button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-[13px] leading-[19px] text-foreground">
          {error}
        </p>
      ) : null}
      {error && code ? (
        <pre className="max-h-[180px] overflow-auto rounded-[8px] bg-secondary p-[12px] font-mono text-[12px] whitespace-pre-wrap">
          {code}
        </pre>
      ) : null}
      {visible && svg ? <DiagramSvg svg={svg} /> : null}
      {visible && shown.length > 0 ? (
        <section className="flex flex-col gap-[8px]">
          <h3 className="text-[13px] font-medium text-muted-foreground">Cần biết trước</h3>
          {shown.map((concept) => (
            <article
              key={concept.name}
              className="flex flex-col gap-[6px] rounded-[12px] border p-[12px]"
            >
              <div className="flex items-baseline justify-between gap-[8px]">
                <h4 className="text-[14px] font-medium">{concept.name}</h4>
                <button
                  type="button"
                  className="font-mono text-[12px] text-link"
                  onClick={() => seek(concept.seconds)}
                >
                  {formatMs(concept.seconds * 1000)}
                </button>
              </div>
              <p className="text-body text-card-foreground">{concept.explanation}</p>
              <p className="text-[13px] text-muted-foreground">{concept.why}</p>
              {concept.prerequisites.length > 0 ? (
                <p className="text-[12px] text-subtle-foreground">
                  Cần biết trước: {concept.prerequisites.join(", ")}
                </p>
              ) : null}
              {concept.related.length > 0 ? (
                <p className="text-[12px] text-subtle-foreground">
                  Liên quan: {concept.related.join(", ")}
                </p>
              ) : null}
              <div className="flex gap-[8px]">
                <button
                  type="button"
                  className={cn(secondaryButton, smallButton)}
                  onClick={() => teach(concept, false)}
                >
                  Giảng khái niệm này
                </button>
                <button
                  type="button"
                  className={cn(secondaryButton, smallButton)}
                  onClick={() => teach(concept, true)}
                >
                  Đào sâu
                </button>
              </div>
            </article>
          ))}
        </section>
      ) : null}
      <AuthorView ctx={ctx} selection={selection} settings={settings} />
    </div>
  )
}
