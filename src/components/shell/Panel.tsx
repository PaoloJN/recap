import { ClosedCaptioning, Key, WarningCircle } from "@phosphor-icons/react"
import { type ReactNode, useEffect, useMemo, useRef } from "react"
import { ChatPanel } from "@/components/chat/ChatPanel"
import { SummaryActions } from "@/components/summary/SummaryActions"
import { SummaryProvider } from "@/components/summary/SummaryContext"
import { SummaryPanel } from "@/components/summary/SummaryPanel"
import { useSummary } from "@/components/summary/useSummary"
import { TranscriptPanel } from "@/components/transcript/TranscriptPanel"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useSettings } from "@/hooks/useSettings"
import { useStorageItem } from "@/hooks/useStorageItem"
import { useTheme } from "@/hooks/useTheme"
import { useVideo, type VideoState } from "@/hooks/useVideo"
import { downloadText } from "@/lib/download"
import { exportVideoMarkdown, slugify } from "@/lib/export"
import {
  apiKeysItem,
  chatsItem,
  DEFAULT_SETTINGS,
  type Settings,
  summariesItem,
} from "@/lib/storage"
import type { ModelSelection, PanelTab, TranscriptStatus, VideoContext } from "@/lib/types"
import { cn } from "@/lib/utils"
import { LiveChapterBar } from "./ChapterBar"
import { CollapsedRow } from "./CollapsedRow"
import { collapsedStatus } from "./collapsed-status"
import { EmptyState } from "./EmptyState"
import { Header } from "./Header"
import { MoreMenu } from "./MoreMenu"
import { usePanelNav } from "./NavigationContext"
import { usePortalContainer } from "./PortalContainer"
import { SettingsView } from "./SettingsView"
import { TabRow } from "./TabRow"
import { useToast } from "./ToastContext"

type ReadyTranscript = Extract<TranscriptStatus, { state: "ready" }>

const TEXT_SIZE_CLASS = { s: "text-size-s", m: "text-size-m", l: "text-size-l" } as const

function TranscriptSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-4">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  )
}

function PageError({ video }: { video: VideoState }) {
  return (
    <EmptyState
      icon={WarningCircle}
      iconWeight="fill"
      title="Couldn't load this video"
      description={video.pageError ?? undefined}
      action={
        <Button size="sm" variant="outline" onClick={video.reload}>
          Retry
        </Button>
      }
    />
  )
}

/** Loading / no captions / error states until the transcript and context are ready. */
function TranscriptGate({
  video,
  children,
}: {
  video: VideoState
  children: (ready: ReadyTranscript, context: VideoContext) => ReactNode
}): ReactNode {
  const { transcript } = video
  if (video.pageError !== null) return <PageError video={video} />
  switch (transcript.state) {
    case "loading":
      return <TranscriptSkeleton />
    case "unavailable":
      return (
        <EmptyState
          icon={ClosedCaptioning}
          title="No captions on this video"
          description="Summaries, chat and the transcript all need captions. Try another video."
        />
      )
    case "error":
      return (
        <EmptyState
          icon={WarningCircle}
          iconWeight="fill"
          title="Couldn't load the transcript"
          description={transcript.message}
          action={
            <Button size="sm" variant="outline" onClick={video.reload}>
              Retry
            </Button>
          }
        />
      )
    case "ready":
      return video.context ? children(transcript, video.context) : <TranscriptSkeleton />
  }
}

interface BodyProps {
  tab: PanelTab
  hasKey: boolean
  settings: Settings
  selection: ModelSelection
  video: VideoState
  onAddKey(): void
}

function Body({ tab, hasKey, settings, selection, video, onAddKey }: BodyProps) {
  const noKey = (
    <EmptyState
      icon={Key}
      title="Add a key to get started"
      description="Your key is stored locally in this extension and sent only to the provider you choose."
      action={
        <Button size="sm" onClick={onAddKey}>
          Add API key
        </Button>
      }
    />
  )
  // All three stay mounted so in-flight chat streams and transcript search/scroll survive tab
  // switches; inactive ones are hidden (a class, since the panels set their own display).
  const pane = (name: PanelTab) => (tab === name ? "contents" : "hidden")
  return (
    <>
      <div className={pane("summary")}>
        {/* SummaryPanel handles transcript loading, no captions and errors itself. */}
        {!hasKey ? (
          noKey
        ) : video.pageError !== null ? (
          <PageError video={video} />
        ) : (
          <SummaryPanel video={video} />
        )}
      </div>
      <div className={pane("transcript")}>
        <TranscriptGate video={video}>
          {(transcript) => (
            <TranscriptPanel transcript={transcript} active={tab === "transcript"} />
          )}
        </TranscriptGate>
      </div>
      <div className={pane("chat")}>
        {hasKey ? (
          <TranscriptGate video={video}>
            {(_, context) => (
              <ChatPanel context={context} selection={selection} language={settings.language} />
            )}
          </TranscriptGate>
        ) : (
          noKey
        )}
      </div>
    </>
  )
}

export function Panel() {
  const nav = usePanelNav()
  const { open, setOpen, tab, view, setView } = nav
  const [storedSettings] = useSettings()
  const [apiKeys] = useStorageItem(apiKeysItem)
  const youtubeTheme = useTheme()
  const toast = useToast()
  const container = usePortalContainer()
  const cardRef = useRef<HTMLDivElement>(null)
  const video = useVideo(open)

  const settings = storedSettings ?? DEFAULT_SETTINGS
  const provider = settings.provider
  const model = settings.models[provider]
  const selection = useMemo<ModelSelection>(() => ({ provider, model }), [provider, model])
  const hasKey = Boolean(apiKeys?.[provider])
  const summary = useSummary(video.context, selection, settings, open && hasKey)

  const dark = settings.theme === "youtube" ? youtubeTheme === "dark" : settings.theme === "dark"
  // Portaled menus/tooltips render into the shadow container, outside the card.
  useEffect(() => {
    container?.classList.toggle("dark", dark)
    return () => container?.classList.remove("dark")
  }, [container, dark])

  const { page } = video
  const videoId = page?.metadata.videoId ?? null

  const openSettings = () => {
    setView("settings")
    if (!open) setOpen(true)
  }

  const exportMarkdown = () => {
    if (!page) return
    const { metadata } = page
    void Promise.all([summariesItem.getValue(), chatsItem.getValue()]).then(
      ([summaries, chats]) => {
        const filename = `${slugify(metadata.title)}.md`
        const text = exportVideoMarkdown(
          metadata,
          summaries[metadata.videoId]?.text,
          chats[metadata.videoId]?.messages,
        )
        downloadText(filename, text)
        toast(`Saved ${filename}`)
      },
      () => toast("Couldn't export"),
    )
  }

  const showShortcuts = () => {
    openSettings()
    requestAnimationFrame(() => {
      cardRef.current?.querySelector("#shortcuts")?.scrollIntoView({ behavior: "smooth" })
    })
  }

  const status = collapsedStatus({
    hasKey,
    transcript: video.transcript.state,
    summary: summary.status,
    style: summary.style,
    momentCount: summary.parsed.moments.length,
  })

  const author = page
    ? page.metadata.author
    : video.pageError !== null
      ? "Couldn't load video"
      : video.videoId === null
        ? "No video open"
        : "Loading…"
  const showMain = open && view === "main"
  const transcriptScrolls = tab === "transcript" && showMain && video.transcript.state === "ready"

  return (
    <SummaryProvider value={summary}>
      <div
        ref={cardRef}
        className={cn(
          "flex flex-col overflow-hidden rounded-[12px] border bg-background font-sans text-body text-foreground antialiased",
          open ? "h-[640px]" : "h-auto",
          TEXT_SIZE_CLASS[settings.textSize],
          dark && "dark",
        )}
      >
        <Header
          title={page?.metadata.title ?? "YouTube AI"}
          author={author}
          hasVideo={page !== null}
          open={open}
          onToggleOpen={() => setOpen(!open)}
          onOpenSettings={openSettings}
          moreMenu={
            <MoreMenu videoId={videoId} onExport={exportMarkdown} onShortcuts={showShortcuts} />
          }
        />
        {page && page.metadata.durationSeconds > 0 && (view === "main" || !open) ? (
          <LiveChapterBar
            chapters={page.chapters}
            durationSeconds={page.metadata.durationSeconds}
          />
        ) : null}
        {open ? null : <CollapsedRow status={status} onExpand={() => setOpen(true)} />}
        {open && view !== "main" && storedSettings && apiKeys ? (
          // Tasks 11–12 replace this with ConnectView (onboarding) and the v3 SettingsView.
          <div className="min-h-0 flex-1 overflow-auto">
            <SettingsView
              settings={storedSettings}
              apiKeys={apiKeys}
              onBack={() => setView("main")}
            />
          </div>
        ) : null}
        {/* Kept mounted while collapsed or in settings so streams and panel state survive. */}
        <div className={showMain ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
          <TabRow right={tab === "summary" && hasKey ? <SummaryActions /> : null} />
          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col",
              transcriptScrolls ? "overflow-hidden" : "overflow-auto",
            )}
          >
            <Body
              tab={tab}
              hasKey={hasKey}
              settings={settings}
              selection={selection}
              video={video}
              onAddKey={() => setView("onboarding")}
            />
          </div>
        </div>
      </div>
    </SummaryProvider>
  )
}
