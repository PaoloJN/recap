import { CaptionsOff, KeyRound, TriangleAlert } from "lucide-react"
import { type ReactNode, useMemo, useState } from "react"
import { ChatPanel } from "@/components/chat/ChatPanel"
import { SummaryPanel } from "@/components/summary/SummaryPanel"
import { TranscriptPanel } from "@/components/transcript/TranscriptPanel"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useStorageItem } from "@/hooks/useStorageItem"
import { useVideo, type VideoState } from "@/hooks/useVideo"
import {
  type ApiKeys,
  apiKeysItem,
  panelStateItem,
  type Settings,
  settingsItem,
} from "@/lib/storage"
import type { ModelSelection, PanelTab, VideoMetadata } from "@/lib/types"
import { cn } from "@/lib/utils"
import { EmptyState } from "./EmptyState"
import { Header } from "./Header"
import { SettingsView } from "./SettingsView"

interface BodyProps {
  tab: PanelTab
  settings: Settings
  apiKeys: ApiKeys
  selection: ModelSelection
  video: VideoState
  onOpenSettings(): void
}

function VideoStrip({ metadata }: { metadata: VideoMetadata }) {
  const label = metadata.author ? `${metadata.title} · ${metadata.author}` : metadata.title
  return (
    <div className="truncate border-b px-3 py-1.5 text-xs text-muted-foreground" title={label}>
      {label}
    </div>
  )
}

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

function Body({ tab, settings, apiKeys, selection, video, onOpenSettings }: BodyProps): ReactNode {
  if (!apiKeys[settings.provider]) {
    return (
      <EmptyState
        icon={KeyRound}
        title="Add an API key to get started"
        description="Your key is stored locally in this extension and sent only to the provider you choose."
        action={
          <Button size="sm" onClick={onOpenSettings}>
            Open settings
          </Button>
        }
      />
    )
  }

  const { transcript, context } = video
  switch (transcript.state) {
    case "loading":
      return <TranscriptSkeleton />
    case "unavailable":
      return (
        <EmptyState
          icon={CaptionsOff}
          title="This video has no transcript"
          description="Summaries and chat need captions. Try another video."
        />
      )
    case "error":
      return (
        <EmptyState
          icon={TriangleAlert}
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
      break
  }

  if (!context) return <TranscriptSkeleton />
  // All three stay mounted so in-flight chat/summary streams and transcript search/scroll survive
  // tab switches; inactive ones are hidden (a class, since the panels set their own display).
  const pane = (name: PanelTab) => (tab === name ? "contents" : "hidden")
  return (
    <>
      <div className={pane("summary")}>
        <SummaryPanel context={context} selection={selection} />
      </div>
      <div className={pane("transcript")}>
        <TranscriptPanel transcript={transcript} active={tab === "transcript"} />
      </div>
      <div className={pane("chat")}>
        <ChatPanel context={context} selection={selection} />
      </div>
    </>
  )
}

export function Panel() {
  const [panelState, setPanelState] = useStorageItem(panelStateItem)
  const [settings] = useStorageItem(settingsItem)
  const [apiKeys] = useStorageItem(apiKeysItem)
  const [showSettings, setShowSettings] = useState(false)
  const provider = settings?.provider
  const model = provider ? settings?.models[provider] : undefined
  const selection = useMemo<ModelSelection | null>(
    () => (provider && model ? { provider, model } : null),
    [provider, model],
  )
  const video = useVideo(Boolean(panelState?.open))

  if (!panelState) return null

  const openSettings = () => {
    setShowSettings(true)
    if (!panelState.open) void setPanelState({ ...panelState, open: true })
  }

  const selectTab = (tab: PanelTab) => {
    setShowSettings(false)
    void setPanelState({ tab, open: true })
  }

  const toggleOpen = () => {
    void setPanelState({ ...panelState, open: !panelState.open })
  }

  const transcriptScrolls =
    panelState.tab === "transcript" && !showSettings && video.transcript.state === "ready"

  return (
    <main className="mb-3 flex w-full flex-col gap-2">
      <Header
        tab={panelState.tab}
        open={panelState.open}
        settingsActive={showSettings}
        onTabSelect={selectTab}
        onToggleOpen={toggleOpen}
        onOpenSettings={openSettings}
      />
      {settings && apiKeys && selection ? (
        // Kept mounted while collapsed so streams and panel state survive; hidden instead.
        <div
          className={cn(
            "max-h-[520px] flex-col rounded-lg border bg-card text-card-foreground",
            panelState.open ? "flex" : "hidden",
            transcriptScrolls ? "overflow-hidden" : "overflow-auto",
          )}
        >
          {video.page ? <VideoStrip metadata={video.page.metadata} /> : null}
          {showSettings ? (
            <SettingsView
              settings={settings}
              apiKeys={apiKeys}
              onBack={() => setShowSettings(false)}
            />
          ) : null}
          {/* Settings is an alternate view: the body stays mounted underneath, just hidden. */}
          <div className={showSettings ? "hidden" : "contents"}>
            <Body
              tab={panelState.tab}
              settings={settings}
              apiKeys={apiKeys}
              selection={selection}
              video={video}
              onOpenSettings={openSettings}
            />
          </div>
        </div>
      ) : null}
    </main>
  )
}
