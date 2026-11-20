import { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import { DiagramResult } from "@/components/diagram/DiagramPanel"
import { ToastProvider } from "@/components/shell/ToastContext"
import { parseDiagramResponse } from "@/lib/diagram/parse"
import { renderMermaidSvg } from "@/lib/diagram/render"
import type { DiagramLink } from "@/lib/types"
import "@/assets/tailwind.css"

const TRANSCRIPT = [
  ["0:00", "Today we'll look at how a chat message moves through the system."],
  ["0:12", "The browser talks to an API Gateway."],
  ["0:28", "The API Gateway forwards the message to a Worker."],
  ["0:45", "The Worker writes it to Redis."],
  ["1:02", "Then it publishes on Kafka so other clients update."],
] as const

const MOCK = `\`\`\`mermaid
flowchart TD
  A["Trình duyệt"] --> B["API Gateway"]
  B --> C["Worker"]
  C --> D["Redis"]
  C --> E["Kafka"]
\`\`\`

## Mốc thời gian
- Trình duyệt — 0:12
- API Gateway — 0:12
- Worker — 0:28
- Redis — 0:45
- Kafka — 1:02
`

type Ready = { svg: string; code: string; links: DiagramLink[] }

function Preview() {
  const [ready, setReady] = useState<Ready | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const parsed = parseDiagramResponse(MOCK)
    if (!parsed.code) {
      setError("Mocked reply had no Mermaid diagram.")
      return
    }
    const code = parsed.code
    void renderMermaidSvg(code, false).then(
      (svg) => setReady({ svg, code, links: parsed.links }),
      (err) => setError(err instanceof Error ? err.message : String(err)),
    )
  }, [])

  return (
    <div className="min-h-screen bg-[#f2f2f2] p-[24px] text-foreground">
      <video
        muted
        className="html5-main-video"
        data-testid="player"
        src="/sample.mp4"
        preload="auto"
        style={{ position: "absolute", width: 16, height: 16, opacity: 0 }}
      />
      <div
        data-testid="diagram-panel"
        className="relative flex w-[400px] flex-col overflow-hidden rounded-[12px] border bg-background font-sans text-foreground"
      >
        <div className="px-[16px] pt-[14px] pb-[8px]">
          <p className="text-[14px] leading-[20px] font-medium">How a chat message moves</p>
          <p className="text-[12px] leading-[16px] text-muted-foreground">
            Sample transcript · mocked model
          </p>
        </div>
        <div className="flex items-center gap-[6px] border-b px-[12px] pb-[12px]">
          {["Summary", "Transcript", "Chat", "Sơ đồ"].map((label) => (
            <span
              key={label}
              className={
                label === "Sơ đồ"
                  ? "rounded-[8px] bg-primary px-[10px] py-[6px] text-[13px] font-medium text-primary-foreground"
                  : "rounded-[8px] bg-secondary px-[10px] py-[6px] text-[13px] font-medium"
              }
            >
              {label}
            </span>
          ))}
        </div>
        <div className="flex flex-col gap-[12px] p-[16px]">
          <ol className="flex flex-col gap-[6px] text-[13px] leading-[18px] text-muted-foreground">
            {TRANSCRIPT.map(([time, line]) => (
              <li key={time}>
                <span className="mr-[8px] font-mono text-[12px] text-link">{time}</span>
                {line}
              </li>
            ))}
          </ol>
          <p data-testid="diagram-status" className="sr-only">
            {error ? `error: ${error}` : ready ? "ready" : "loading"}
          </p>
          {error ? (
            <p role="alert" className="text-[14px] text-destructive">
              {error}
            </p>
          ) : null}
          {ready ? (
            <ToastProvider>
              <DiagramResult
                svg={ready.svg}
                code={ready.code}
                links={ready.links}
                title="How a chat message moves"
              />
            </ToastProvider>
          ) : null}
        </div>
      </div>
    </div>
  )
}

const root = document.getElementById("root")
if (!root) throw new Error("missing root")
createRoot(root).render(<Preview />)
