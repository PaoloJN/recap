import { WarningCircle } from "@phosphor-icons/react"
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useChatDraft } from "@/components/chat/ChatDraftContext"
import { ChatPanel } from "@/components/chat/ChatPanel"
import { NewChatButton } from "@/components/chat/NewChatButton"
import { ConnectView } from "@/components/onboarding/ConnectView"
import { access } from "@/components/pro/access"
import { NoAccessGate } from "@/components/pro/NoAccessGate"
import { useSignedOut } from "@/components/pro/useSignedOut"
import { WelcomeView } from "@/components/pro/WelcomeView"
import { NoCaptions } from "@/components/summary/NoCaptions"
import { SummaryActions } from "@/components/summary/SummaryActions"
import { SummaryProvider } from "@/components/summary/SummaryContext"
import { SummaryPanel } from "@/components/summary/SummaryPanel"
import { useSummary } from "@/components/summary/useSummary"
import { TranscriptPanel } from "@/components/transcript/TranscriptPanel"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { usePro } from "@/hooks/usePro"
import { useSettings } from "@/hooks/useSettings"
import { useShortcuts } from "@/hooks/useShortcuts"
import { useStorageItem } from "@/hooks/useStorageItem"
import { useTheme } from "@/hooks/useTheme"
import { useVideo, type VideoState } from "@/hooks/useVideo"
import { downloadText } from "@/lib/download"
import { exportVideoMarkdown, slugify } from "@/lib/export"
import { PRO_ENABLED } from "@/lib/pro/config"
import { apiKeysItem, chatsItem, DEFAULT_SETTINGS, summariesItem } from "@/lib/storage"
import type { ModelSelection, PanelTab, TranscriptStatus, VideoContext } from "@/lib/types"
import { cn } from "@/lib/utils"
import { LiveChapterBar } from "./ChapterBar"
import { CollapsedRow } from "./CollapsedRow"
import { collapsedStatus } from "./collapsed-status"
import { EmptyState } from "./EmptyState"
import { Header } from "./Header"
import { MoreMenu } from "./MoreMenu"
import { usePanelNav } from "./NavigationContext"
import { DialogContainerContext, usePortalContainer } from "./PortalContainer"
import { SettingsVersion, SettingsView } from "./SettingsView"
import { SubHeader } from "./SubHeader"
import { TabRow } from "./TabRow"
import { useToast } from "./ToastContext"

type ReadyTranscript = Extract<TranscriptStatus, { state: "ready" }>

const PORTAL_CLASSES = ["font-sans", "antialiased", "text-foreground"]

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
        <div className="px-[16px]">
          <NoCaptions variant="summary" />
        </div>
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
  hasAccess: boolean
  /** The Recap Pro session was lost (401 or sign-out) while this page was open. */
  signedOut: boolean
  video: VideoState
}

function Body({ tab, hasAccess, signedOut, video }: BodyProps) {
  // All three stay mounted so in-flight chat streams and transcript search/scroll survive tab
  // switches; inactive ones are hidden (a class, since the panels set their own display).
  const pane = (name: PanelTab) => (tab === name ? "contents" : "hidden")
  return (
    <>
      <div className={pane("summary")}>
        {/* SummaryPanel handles transcript loading, no captions and errors itself. */}
        {!hasAccess ? (
          <NoAccessGate verb="summarize videos" signedOut={signedOut} />
        ) : video.pageError !== null ? (
          <PageError video={video} />
        ) : (
          <SummaryPanel video={video} />
        )}
      </div>
      <div className={pane("transcript")}>
        {/* Works without a key; TranscriptPanel handles loading, no captions and errors. */}
        {video.pageError !== null ? (
          <PageError video={video} />
        ) : (
          <TranscriptPanel video={video} active={tab === "transcript"} />
        )}
      </div>
      <div className={pane("chat")}>
        {hasAccess ? (
          <TranscriptGate video={video}>{() => <ChatPanel video={video} />}</TranscriptGate>
        ) : (
          <NoAccessGate verb="chat with videos" signedOut={signedOut} />
        )}
      </div>
    </>
  )
}

export function Panel() {
  const nav = usePanelNav()
  const {
    open,
    setOpen,
    tab,
    view,
    setView,
    onboardingScreen,
    goBack,
    selectTab,
    requestSearchFocus,
    consumeSearchFocus,
  } = nav
  const [storedSettings] = useSettings()
  const [apiKeys] = useStorageItem(apiKeysItem)
  const pro = usePro()
  const youtubeTheme = useTheme()
  const toast = useToast()
  const container = usePortalContainer()
  const cardRef = useRef<HTMLDivElement | null>(null)
  const [card, setCard] = useState<HTMLDivElement | null>(null)
  const setCardRef = useCallback((el: HTMLDivElement | null) => {
    cardRef.current = el
    setCard(el)
  }, [])
  const video = useVideo(open)
  const { hasMessages, reset: resetChatDraft, requestFocus } = useChatDraft()
  // A draft, quote, "current moment" or pending focus request belongs to the video it was made for.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when the video id changes
  useEffect(() => {
    resetChatDraft()
    consumeSearchFocus()
  }, [video.videoId])

  const settings = storedSettings ?? DEFAULT_SETTINGS
  const provider = settings.provider
  const model = settings.models[provider]
  const selection = useMemo<ModelSelection>(() => ({ provider, model }), [provider, model])
  const hasAccess = access(settings, apiKeys, pro) === "ok"
  const signedOut = useSignedOut(pro.signedIn) && provider === "pro"
  const summary = useSummary(video.context, selection, settings, open && hasAccess)

  // An error (or gate) from one provider says nothing about the next: switching clears it.
  const { clearError: clearSummaryError } = summary
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs only when the provider changes
  useEffect(() => {
    clearSummaryError()
  }, [provider])

  // ⌥S on a collapsed card or a still-loading video: the transcript (and so the context) only
  // arrives after the card opens, so the request waits here, tied to the video it was made for.
  const [pendingSummarize, setPendingSummarize] = useState<string | null>(null)
  const contextVideoId = video.context?.metadata.videoId ?? null
  const { status: summaryStatus, generate: generateSummary } = summary
  useEffect(() => {
    if (pendingSummarize === null) return
    if (pendingSummarize !== video.videoId) {
      setPendingSummarize(null)
      return
    }
    if (!hasAccess || contextVideoId !== pendingSummarize || summaryStatus === "streaming") return
    setPendingSummarize(null)
    generateSummary({ force: false })
  }, [pendingSummarize, video.videoId, hasAccess, contextVideoId, summaryStatus, generateSummary])

  const openTab = (t: PanelTab) => {
    setOpen(true)
    setView("main")
    selectTab(t)
  }
  // The card host stays in the DOM after leaving /watch; shortcuts only act on a video page.
  useShortcuts(video.videoId !== null, {
    "focus-chat": () => {
      openTab("chat")
      if (hasAccess) requestFocus()
    },
    summarize: () => {
      openTab("summary")
      // Never restart a running summary; `generate` also ignores a request already in flight.
      if (hasAccess && summary.status !== "streaming") setPendingSummarize(video.videoId)
    },
    "search-transcript": () => {
      openTab("transcript")
      requestSearchFocus()
    },
  })

  const dark = settings.theme === "youtube" ? youtubeTheme === "dark" : settings.theme === "dark"
  // Portaled menus/tooltips render into the shadow container, outside the card, so the
  // container carries the card's typography and theme too (else they inherit YouTube's font).
  useEffect(() => {
    if (!container) return
    container.classList.add(...PORTAL_CLASSES)
    return () => container.classList.remove(...PORTAL_CLASSES)
  }, [container])
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
    // Settings renders once its storage read resolves, so retry for a few frames.
    let frames = 0
    const scroll = () => {
      const target = cardRef.current?.querySelector("#shortcuts")
      if (target) target.scrollIntoView({ behavior: "smooth" })
      else if (++frames < 30) requestAnimationFrame(scroll)
    }
    requestAnimationFrame(scroll)
  }

  const status = collapsedStatus({
    hasKey: hasAccess,
    pageError: video.pageError !== null,
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
  // Summary idle / error / no-captions / no-key screens are short: the card hugs them instead
  // of reserving the full scroll height. Everything that scrolls keeps the fixed 640px.
  const fitContent =
    showMain &&
    tab === "summary" &&
    !(
      summary.status === "streaming" ||
      summary.status === "done" ||
      (summary.status === "error" && summary.text.length > 0)
    )

  return (
    <SummaryProvider value={summary}>
      <DialogContainerContext.Provider value={card}>
        <div
          ref={setCardRef}
          className={cn(
            "relative flex flex-col overflow-hidden rounded-[12px] border bg-background font-sans text-body text-foreground antialiased",
            open && !fitContent ? "h-[640px]" : "h-auto",
            fitContent && "max-h-[640px]",
            TEXT_SIZE_CLASS[settings.textSize],
            dark && "dark",
          )}
        >
          {open && view !== "main" ? (
            <SubHeader
              title={
                view === "settings"
                  ? "Settings"
                  : PRO_ENABLED && onboardingScreen === "welcome"
                    ? "Get started"
                    : "Add API key"
              }
              onBack={goBack}
              right={view === "settings" ? <SettingsVersion /> : null}
            />
          ) : (
            <Header
              title={page?.metadata.title ?? "Recap AI"}
              author={author}
              hasVideo={page !== null}
              open={open}
              onToggleOpen={() => setOpen(!open)}
              onOpenSettings={openSettings}
              moreMenu={
                <MoreMenu videoId={videoId} onExport={exportMarkdown} onShortcuts={showShortcuts} />
              }
            />
          )}
          {page && page.metadata.durationSeconds > 0 && (view === "main" || !open) ? (
            <LiveChapterBar
              chapters={page.chapters}
              durationSeconds={page.metadata.durationSeconds}
            />
          ) : null}
          {open ? null : <CollapsedRow status={status} onExpand={() => setOpen(true)} />}
          {open && view === "onboarding" && storedSettings ? (
            PRO_ENABLED && onboardingScreen === "welcome" ? (
              <WelcomeView />
            ) : (
              <ConnectView
                key={storedSettings.provider}
                initialProvider={storedSettings.provider}
              />
            )
          ) : null}
          {open && view === "settings" ? <SettingsView /> : null}
          {/* Kept mounted while collapsed or in settings so streams and panel state survive. */}
          <div className={showMain ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
            <TabRow
              right={
                !hasAccess ? null : tab === "summary" ? (
                  <SummaryActions />
                ) : tab === "chat" && hasMessages ? (
                  <NewChatButton />
                ) : null
              }
            />
            <div
              className={cn(
                "flex min-h-0 flex-1 flex-col",
                transcriptScrolls ? "overflow-hidden" : "overflow-auto",
              )}
            >
              <Body tab={tab} hasAccess={hasAccess} signedOut={signedOut} video={video} />
            </div>
          </div>
        </div>
      </DialogContainerContext.Provider>
    </SummaryProvider>
  )
}
