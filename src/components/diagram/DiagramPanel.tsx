import {
  ArrowClockwise,
  Copy,
  DownloadSimple,
  Sparkle,
  Stop,
  TreeStructure,
} from "@phosphor-icons/react"
import { useEffect, useRef, useState } from "react"
import { useChatDraft } from "@/components/chat/ChatDraftContext"
import { DiagramFrame } from "@/components/diagram/DiagramFrame"
import { IconButton } from "@/components/shell/IconButton"
import { usePanelNav } from "@/components/shell/NavigationContext"
import { useToast } from "@/components/shell/ToastContext"
import {
  largeButton,
  primaryButton,
  secondaryButton,
  smallButton,
} from "@/components/summary/buttons"
import { useSeek } from "@/hooks/useSeek"
import {
  type DiagramGraphNode,
  edgeLines,
  nodeForLabel,
  nodeFromDomId,
  parseDiagramGraph,
  secondsForLabel,
} from "@/lib/diagram/graph"
import { downloadBlob } from "@/lib/download"
import { slugify } from "@/lib/export"
import { formatMs } from "@/lib/timestamps"
import { buildNodeAskDraft, buildNodeExplainMessage } from "@/lib/tutor/prompts"
import type { DiagramLink } from "@/lib/types"
import { cn } from "@/lib/utils"
import type { DiagramState } from "./useDiagram"

function stripSvg(svg: string): Element | null {
  const parsed = new DOMParser().parseFromString(svg, "image/svg+xml")
  const root = parsed.documentElement
  if (root.nodeName.toLowerCase() !== "svg") return null
  for (const script of root.querySelectorAll("script")) script.remove()
  for (const el of [root, ...root.querySelectorAll("*")]) {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase()
      const value = attr.value.trim().toLowerCase()
      if (name.startsWith("on") || (name === "href" && value.startsWith("javascript:"))) {
        el.removeAttribute(attr.name)
      }
    }
  }
  return root
}

export function DiagramSvg({ svg }: { svg: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const host = ref.current
    if (!host) return
    host.replaceChildren()
    const root = stripSvg(svg)
    if (!root) return
    const node = document.importNode(root, true)
    if (node instanceof SVGElement) {
      node.setAttribute("width", "100%")
      node.style.maxWidth = "100%"
      node.style.height = "auto"
      node.removeAttribute("height")
    }
    host.appendChild(node)
  }, [svg])
  return (
    <div
      ref={ref}
      data-testid="diagram-svg"
      role="img"
      aria-label="Diagram of the video"
      className="overflow-x-auto rounded-[12px] border bg-card p-[8px] [&_svg]:h-auto [&_svg]:max-w-full"
    />
  )
}

function DiagramLinks({
  links,
  onPick,
}: {
  links: DiagramLink[]
  onPick?: (link: DiagramLink, anchor: HTMLElement) => void
}) {
  const seek = useSeek()
  if (links.length === 0) return null
  return (
    <section className="flex flex-col gap-[4px]">
      <div className="flex items-baseline justify-between pb-[4px]">
        <h3 className="text-[13px] leading-[18px] font-medium text-muted-foreground">
          In the video
        </h3>
        <span className="text-[12px] leading-[16px] text-subtle-foreground">
          {onPick ? "Bấm để chọn" : "Click to jump"}
        </span>
      </div>
      <div className="-mx-[8px] flex flex-col">
        {links.map((link, i) => (
          <button
            // biome-ignore lint/suspicious/noArrayIndexKey: the same label can repeat a timestamp
            key={`${link.seconds}-${i}`}
            type="button"
            data-testid="diagram-link"
            className="flex cursor-pointer items-baseline gap-[8px] rounded-[8px] p-[8px] text-left transition-colors duration-150 ease-out outline-none hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/50"
            onClick={(event) => (onPick ? onPick(link, event.currentTarget) : seek(link.seconds))}
          >
            <span className="min-w-0 flex-1 text-body text-pretty text-card-foreground">
              {link.label}
            </span>
            <span className="shrink-0 font-mono text-[12px] font-medium text-link">
              {formatMs(link.seconds * 1000)}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

function SourceBlock({ text }: { text: string }) {
  return (
    <pre className="max-h-[220px] overflow-auto rounded-[8px] bg-secondary p-[12px] font-mono text-[12px] leading-[18px] whitespace-pre-wrap text-card-foreground">
      {text}
    </pre>
  )
}

export function DiagramActions({ diagram }: { diagram: DiagramState }) {
  if (diagram.status === "idle") return null
  if (diagram.status === "streaming" || diagram.status === "fixing") {
    return (
      <IconButton label="Stop" className="[&_svg]:size-[17px]" onClick={diagram.stop}>
        <Stop weight="fill" />
      </IconButton>
    )
  }
  return (
    <IconButton
      label="Regenerate"
      className="[&_svg]:size-[17px]"
      onClick={() => diagram.generate({ force: true })}
    >
      <ArrowClockwise />
    </IconButton>
  )
}

interface NodeMenuState {
  node: DiagramGraphNode
  edges: string[]
  seconds: number | null
  left: number
  top: number
}

function NodeMenu({
  menu,
  onExplain,
  onAsk,
  onSeek,
}: {
  menu: NodeMenuState
  onExplain(): void
  onAsk(): void
  onSeek(): void
}) {
  return (
    <div
      role="menu"
      data-testid="diagram-node-menu"
      className="absolute z-20 flex w-[200px] flex-col rounded-[10px] border bg-card p-[4px] shadow-pop"
      style={{ left: menu.left, top: menu.top }}
    >
      <button type="button" role="menuitem" className={menuItem} onClick={onExplain}>
        Giải thích node này
      </button>
      <button
        type="button"
        role="menuitem"
        className={menuItem}
        disabled={menu.seconds === null}
        onClick={onSeek}
      >
        Xem đoạn video
      </button>
      <button type="button" role="menuitem" className={menuItem} onClick={onAsk}>
        Hỏi thầy
      </button>
    </div>
  )
}

const menuItem =
  "rounded-[8px] px-[8px] py-[8px] text-left text-[13px] leading-[18px] text-card-foreground outline-none hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-40"

export function DiagramResult({
  svg,
  code,
  links,
  title,
  interactive,
}: {
  svg: string | null
  code: string
  links: DiagramLink[]
  title: string
  interactive?: {
    dark: boolean
    onExplain(label: string, edges: string[]): void
    onAsk(label: string, edges: string[]): void
  }
}) {
  const toast = useToast()
  const seek = useSeek()
  const hostRef = useRef<HTMLDivElement>(null)
  const [menu, setMenu] = useState<NodeMenuState | null>(null)
  const [frameFailed, setFrameFailed] = useState(false)
  const graph = parseDiagramGraph(code)

  useEffect(() => {
    if (!menu) return
    const close = (event: Event) => {
      const insideMenu = event.composedPath().some((node) => {
        return node instanceof HTMLElement && node.dataset.testid === "diagram-node-menu"
      })
      if (!insideMenu) setMenu(null)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(null)
    }
    document.addEventListener("pointerdown", close)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", close)
      document.removeEventListener("keydown", onKey)
    }
  }, [menu])

  const place = (
    node: DiagramGraphNode,
    seconds: number | null,
    viewportX: number,
    viewportY: number,
  ) => {
    const host = hostRef.current
    if (!host) return
    const box = host.getBoundingClientRect()
    const width = 200
    const left = Math.min(
      Math.max(8, viewportX - box.left),
      Math.max(8, host.clientWidth - width - 8),
    )
    const top = Math.max(8, viewportY - box.top)
    setMenu({ node, edges: edgeLines(node, graph), seconds, left, top })
  }

  const openNode = (
    node: DiagramGraphNode,
    seconds: number | null,
    viewportX: number,
    viewportY: number,
  ) => {
    place(node, seconds, viewportX, viewportY)
  }

  const copy = () => {
    navigator.clipboard.writeText(code).then(
      () => toast("Copied Mermaid"),
      () => toast("Couldn't copy"),
    )
  }
  const download = () => {
    if (!svg) return
    downloadBlob(
      `${slugify(title)}-diagram.svg`,
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
    )
    toast("Saved SVG")
  }
  const explain = () => {
    if (!menu || !interactive) return
    interactive.onExplain(menu.node.label, menu.edges)
    setMenu(null)
  }
  const ask = () => {
    if (!menu || !interactive) return
    interactive.onAsk(menu.node.label, menu.edges)
    setMenu(null)
  }
  const watch = () => {
    if (menu?.seconds === null || menu?.seconds === undefined) return
    seek(menu.seconds)
    setMenu(null)
  }
  const live = frameFailed ? undefined : interactive
  return (
    <div ref={hostRef} className="relative flex flex-col gap-[16px]" data-testid="diagram-result">
      {live ? (
        <DiagramFrame
          code={code}
          dark={live.dark}
          onError={() => setFrameFailed(true)}
          onNode={(domId, x, y) => {
            const node = nodeFromDomId(domId, graph.nodes)
            if (!node) return
            openNode(node, secondsForLabel(node.label, links), x, y)
          }}
        />
      ) : svg ? (
        <DiagramSvg svg={svg} />
      ) : (
        <div
          aria-hidden
          className="h-[180px] rounded-[12px] bg-secondary"
          style={{ animation: "yt-pulse 1.4s infinite var(--ease-out)" }}
        />
      )}
      <DiagramLinks
        links={links}
        onPick={
          live
            ? (link, anchor) => {
                const rect = anchor.getBoundingClientRect()
                const node = nodeForLabel(link.label, graph)
                openNode(node, link.seconds, rect.left, rect.bottom)
              }
            : undefined
        }
      />
      {menu ? <NodeMenu menu={menu} onExplain={explain} onAsk={ask} onSeek={watch} /> : null}
      <div className="flex flex-wrap gap-[8px]">
        <button type="button" className={cn(secondaryButton, smallButton)} onClick={copy}>
          <Copy aria-hidden />
          Copy Mermaid
        </button>
        <button
          type="button"
          className={cn(secondaryButton, smallButton)}
          onClick={download}
          disabled={!svg}
        >
          <DownloadSimple aria-hidden />
          Download SVG
        </button>
      </div>
    </div>
  )
}

function LiveDiagram({
  svg,
  code,
  links,
  title,
  videoId,
  dark,
}: {
  svg: string | null
  code: string
  links: DiagramLink[]
  title: string
  videoId: string
  dark: boolean
}) {
  const { requestAsk, setDraft, requestFocus } = useChatDraft()
  const { selectTab } = usePanelNav()
  return (
    <DiagramResult
      key={code}
      svg={svg}
      code={code}
      links={links}
      title={title}
      interactive={{
        dark,
        onExplain: (label, edges) => {
          requestAsk(videoId, buildNodeExplainMessage(label, edges), false)
          selectTab("chat")
        },
        onAsk: (label, edges) => {
          setDraft(buildNodeAskDraft(label, edges))
          selectTab("chat")
          requestFocus()
        },
      }}
    />
  )
}

export function DiagramBody({
  diagram,
  title,
  modelLabel,
  videoId,
  dark,
}: {
  diagram: DiagramState
  title: string
  modelLabel: string
  videoId: string
  dark: boolean
}) {
  const { status, code, links, svg, error, raw, generate } = diagram
  if (status === "streaming" || status === "fixing") {
    return (
      <div className="flex flex-col items-start gap-[12px] py-[8px]" aria-busy="true">
        <p className="text-[16px] leading-[24px] font-medium text-foreground">
          {status === "fixing" ? "Fixing diagram syntax…" : "Drawing the diagram…"}
        </p>
        <p className="text-[14px] leading-[21px] text-muted-foreground">
          {status === "fixing"
            ? "Mermaid rejected the first reply. Asking the model to correct it."
            : `Reading the transcript with ${modelLabel}.`}
        </p>
      </div>
    )
  }
  if (status === "error") {
    const source = code || raw
    return (
      <div role="alert" className="flex flex-col gap-[12px]">
        <p className="text-[16px] leading-[24px] font-medium text-foreground">
          Couldn't draw this diagram
        </p>
        <p className="text-[14px] leading-[21px] text-pretty text-muted-foreground">
          {error ?? "Something went wrong."} The reply is below.
        </p>
        {source ? <SourceBlock text={source} /> : null}
        <button
          type="button"
          className={cn(primaryButton, smallButton, "self-start")}
          onClick={() => generate({ force: true })}
        >
          Try again
        </button>
      </div>
    )
  }
  if (status === "done" && code) {
    return (
      <LiveDiagram
        svg={svg}
        code={code}
        links={links}
        title={title}
        videoId={videoId}
        dark={dark}
      />
    )
  }
  return (
    <div className="flex flex-col gap-[16px] px-[4px] py-[24px]">
      <div className="flex size-[44px] items-center justify-center rounded-[12px] bg-secondary text-foreground">
        <TreeStructure className="size-[22px]" aria-hidden />
      </div>
      <div className="flex flex-col gap-[6px]">
        <p className="text-[16px] leading-[24px] font-medium text-foreground">Diagram this video</p>
        <p className="text-[14px] leading-[21px] text-pretty text-muted-foreground">
          One diagram of the architecture, flow, or main ideas. Labels use your answer language and
          keep English technical terms.
        </p>
      </div>
      <button
        type="button"
        className={cn(primaryButton, largeButton, "self-start")}
        onClick={() => generate()}
      >
        <Sparkle weight="fill" aria-hidden />
        Draw diagram
      </button>
    </div>
  )
}
