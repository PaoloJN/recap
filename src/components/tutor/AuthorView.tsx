import { useRef, useState } from "react"
import { Markdown } from "@/components/markdown/Markdown"
import {
  largeButton,
  primaryButton,
  secondaryButton,
  smallButton,
} from "@/components/summary/buttons"
import type { Settings } from "@/lib/storage"
import { openStream, readTextFromUIStream } from "@/lib/transport"
import type { ModelSelection, VideoContext } from "@/lib/types"
import { cn } from "@/lib/utils"

type Status = "idle" | "streaming" | "done" | "error"

/** On-click reading of the author's argument. Web search is requested and dropped if the provider rejects it. */
export function AuthorView({
  ctx,
  selection,
  settings,
}: {
  ctx: VideoContext
  selection: ModelSelection
  settings: Settings
}) {
  const [status, setStatus] = useState<Status>("idle")
  const [text, setText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const run = () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setStatus("streaming")
    setError(null)
    setText("")
    void (async () => {
      try {
        const full = await readTextFromUIStream(
          openStream(
            {
              kind: "author",
              context: ctx,
              selection,
              language: settings.language,
              customInstructions: settings.customInstructions,
              tutor: { mode: settings.tutorMode, level: settings.tutorLevel },
              role: settings.role,
              reasoningEffort: settings.reasoningEffort,
              web: true,
            },
            { signal: controller.signal },
          ),
          (partial) => {
            if (!controller.signal.aborted) setText(partial)
          },
        )
        if (controller.signal.aborted) return
        setText(full)
        setStatus(full.trim() ? "done" : "idle")
      } catch (err) {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : "Không phân tích được góc nhìn tác giả.")
        setStatus("error")
      }
    })()
  }

  return (
    <section className="flex flex-col gap-[10px] border-t pt-[16px]">
      <div className="flex flex-wrap items-center gap-[8px]">
        <h3 className="text-[13px] font-medium text-muted-foreground">Góc nhìn tác giả</h3>
        <button
          type="button"
          className={cn(primaryButton, largeButton)}
          disabled={status === "streaming"}
          onClick={run}
        >
          {status === "streaming" ? "Đang phân tích…" : "Phân tích"}
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
      <p className="text-[12px] leading-[16px] text-muted-foreground">
        Tách lời tác giả khỏi phần diễn giải. So với quan điểm phổ biến thì tra web khi provider cho
        phép.
      </p>
      {error ? (
        <p role="alert" className="text-[13px] leading-[19px]">
          {error}
        </p>
      ) : null}
      {text ? (
        <Markdown className="text-body text-pretty text-card-foreground">{text}</Markdown>
      ) : null}
    </section>
  )
}
