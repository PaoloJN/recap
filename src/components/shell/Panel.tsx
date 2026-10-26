import { CaptionsOff, KeyRound, TriangleAlert } from "lucide-react"
import { type ReactNode, useState } from "react"
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
import type { ModelSelection, PanelTab } from "@/lib/types"
import { EmptyState } from "./EmptyState"
import { Header } from "./Header"
import { SettingsView } from "./SettingsView"

interface BodyProps {
  tab: PanelTab
  settings: Settings
  apiKeys: ApiKeys
  video: VideoState
  onOpenSettings(): void
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

function Body({ tab, settings, apiKeys, video, onOpenSettings }: BodyProps): ReactNode {
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
  const selection: ModelSelection = {
    provider: settings.provider,
    model: settings.models[settings.provider],
  }
  switch (tab) {
    case "summary":
      return <SummaryPanel context={context} selection={selection} />
    case "transcript":
      return <TranscriptPanel transcript={transcript} />
    case "chat":
      return <ChatPanel context={context} selection={selection} />
  }
}

export function Panel() {
  const [panelState, setPanelState] = useStorageItem(panelStateItem)
  const [settings] = useStorageItem(settingsItem)
  const [apiKeys] = useStorageItem(apiKeysItem)
  const [showSettings, setShowSettings] = useState(false)
  const video = useVideo()

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

  const loaded = settings !== undefined && apiKeys !== undefined

  return (
    <main className="mb-3 flex w-full flex-col gap-2 @container">
      <Header
        title={video.page?.metadata.title}
        tab={panelState.tab}
        open={panelState.open}
        settingsActive={showSettings}
        onTabSelect={selectTab}
        onToggleOpen={toggleOpen}
        onOpenSettings={openSettings}
      />
      {panelState.open && loaded ? (
        <div className="max-h-[520px] overflow-auto rounded-lg border bg-card text-card-foreground">
          {showSettings ? (
            <SettingsView
              settings={settings}
              apiKeys={apiKeys}
              onBack={() => setShowSettings(false)}
            />
          ) : (
            <Body
              tab={panelState.tab}
              settings={settings}
              apiKeys={apiKeys}
              video={video}
              onOpenSettings={openSettings}
            />
          )}
        </div>
      ) : null}
    </main>
  )
}
