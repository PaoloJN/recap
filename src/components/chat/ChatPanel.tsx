import { useChat } from "@ai-sdk/react"
import type { UIMessage } from "ai"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePanelNav } from "@/components/shell/NavigationContext"
import { useToast } from "@/components/shell/ToastContext"
import { useSummaryContext } from "@/components/summary/SummaryContext"
import { Skeleton } from "@/components/ui/skeleton"
import { updateSettings, useSettings } from "@/hooks/useSettings"
import type { VideoState } from "@/hooks/useVideo"
import type { VideoType } from "@/lib/prompts/video-type"
import { DEFAULT_SETTINGS } from "@/lib/storage"
import { chunkBySentences, findActiveIndex } from "@/lib/transcript/parse"
import { displayText } from "@/lib/transcript/text"
import { PortChatTransport } from "@/lib/transport"
import { tutorChoice } from "@/lib/tutor/choice"
import { buildDeeperMessage, buildMomentMessage } from "@/lib/tutor/prompts"
import type { TutorLevel, TutorMode } from "@/lib/tutor/types"
import { webPlan } from "@/lib/tutor/web"
import type { ChatMessageMetadata, ModelSelection, VideoContext } from "@/lib/types"
import { getVideoElement } from "@/lib/youtube/player"
import { type ChatQuote, useChatDraft } from "./ChatDraftContext"
import { ChatEmptyState, pickSuggestions } from "./ChatEmptyState"
import { Composer } from "./Composer"
import { MessageList, messageMeta } from "./MessageList"
import { ModelPicker } from "./ModelPicker"
import { TutorPill } from "./TutorPill"
import { markStopped, shouldClearDraft, withMetadata } from "./thread"
import { useChatHistory } from "./useChatHistory"
import { usePreserveScroll } from "./usePreserveScroll"

const newMessageId = () => crypto.randomUUID()
const EXPLAIN_NOW_PROMPT = "Explain what's happening here."

function ChatSkeleton() {
  return (
    <div
      className="flex flex-1 flex-col gap-[8px] p-[16px]"
      role="status"
      aria-label="Loading chat"
    >
      <Skeleton className="h-[14px] w-2/3" />
      <Skeleton className="h-[14px] w-1/2" />
    </div>
  )
}

/** Chat for the current video. Panel renders it once the transcript (and so the context) is ready. */
export function ChatPanel({
  video,
  videoType,
}: {
  video: VideoState
  videoType: VideoType | null
}) {
  const context = video.context
  const videoId = context?.metadata.videoId ?? ""
  const history = useChatHistory(videoId)
  if (!context || !history.ready) return <ChatSkeleton />
  return (
    <ChatView
      key={videoId}
      context={context}
      videoType={videoType}
      title={video.page?.metadata.title}
      initialMessages={history.initialMessages}
      hasStored={history.initialMessages !== undefined}
      save={history.save}
      clear={history.clear}
    />
  )
}

interface ChatViewProps {
  context: VideoContext
  videoType: VideoType | null
  title: string | undefined
  initialMessages: UIMessage[] | undefined
  /** Whether storage holds a thread for this video; going false means it was cleared elsewhere. */
  hasStored: boolean
  save(messages: UIMessage[], title?: string): Promise<void>
  clear(): Promise<void>
}

function ChatView({
  context,
  videoType,
  title,
  initialMessages,
  hasStored,
  save,
  clear,
}: ChatViewProps) {
  const [stored] = useSettings()
  const settings = stored ?? DEFAULT_SETTINGS
  const { tab, open, view } = usePanelNav()
  const toast = useToast()
  const summary = useSummaryContext()
  const {
    draft,
    setDraft,
    quote,
    setQuote,
    attachTime,
    setAttachTime,
    focusPending,
    consumeFocus,
    setHasMessages,
    newChatToken,
    explain,
    ask: pendingAsk,
  } = useChatDraft()

  const selection = useMemo<ModelSelection>(
    () => ({ provider: settings.provider, model: settings.models[settings.provider] }),
    [settings.provider, settings.models],
  )
  // Research mode lives only in this view: New chat or another video (a new key) turns it off.
  const [research, setResearch] = useState(false)
  const researchSupported = webPlan(selection.provider) !== "none"
  const researchOn = research && researchSupported
  const choice = tutorChoice(videoType, settings.tutorByType)
  const saveChoice = (next: { mode: TutorMode; level: TutorLevel }) => {
    const key = videoType ?? "other"
    void updateSettings({
      tutorMode: next.mode,
      tutorLevel: next.level,
      tutorByType: { ...settings.tutorByType, [key]: next },
    })
  }

  // The transport is built once per view (keyed by video); refs carry the latest values.
  const latest = useRef({
    context,
    selection,
    language: settings.language,
    title,
    tutor: choice,
    role: settings.role,
    customInstructions: settings.customInstructions,
    reasoningEffort: settings.reasoningEffort,
  })
  latest.current = {
    context,
    selection,
    language: settings.language,
    title,
    tutor: choice,
    role: settings.role,
    customInstructions: settings.customInstructions,
    reasoningEffort: settings.reasoningEffort,
  }
  const webRef = useRef(false)
  const researchRef = useRef(researchOn)
  researchRef.current = researchOn
  const transport = useMemo(
    () =>
      new PortChatTransport(() => {
        // Regenerate and Retry skip `send`, so Research mode is read here as well.
        const web = webRef.current || researchRef.current
        webRef.current = false
        return {
          context: latest.current.context,
          selection: latest.current.selection,
          language: latest.current.language,
          tutor: latest.current.tutor,
          role: latest.current.role,
          customInstructions: latest.current.customInstructions,
          reasoningEffort: latest.current.reasoningEffort,
          web,
        }
      }),
    [],
  )

  // Set while New is in flight so the abort-triggered onFinish cannot re-save the cleared chat.
  const clearingRef = useRef(false)
  // Set while Stop is in flight so onFinish marks the partial reply "Stopped.".
  const stoppingRef = useRef(false)
  // Set once a Stop has been marked, so the fallback after `stop()` doesn't mark twice.
  const stopMarkedRef = useRef(false)

  const { messages, sendMessage, status, stop, setMessages, error, regenerate, clearError } =
    useChat({
      id: context.metadata.videoId,
      messages: initialMessages,
      transport,
      onFinish: ({ messages: finished, isError, isAbort }) => {
        if (isError || clearingRef.current) return
        let next = finished
        if (isAbort || stoppingRef.current) {
          next = markStopped(finished, newMessageId)
          stopMarkedRef.current = true
          setMessages(next)
        }
        save(next, latest.current.title).catch((e: unknown) =>
          console.error("Failed to save chat", e),
        )
      },
    })

  const busy = status === "submitted" || status === "streaming"

  useEffect(() => {
    setHasMessages(messages.length > 0)
  }, [messages.length, setHasMessages])
  useEffect(() => () => setHasMessages(false), [setHasMessages])

  // Scrolling: stay pinned to the bottom while the user is there; jump down on send.
  const scrollRef = useRef<HTMLDivElement>(null)
  const pinnedRef = useRef(true)
  usePreserveScroll(scrollRef, pinnedRef)
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-pin on every message/stream update
  useEffect(() => {
    const el = scrollRef.current
    if (el && pinnedRef.current) el.scrollTop = el.scrollHeight
  }, [messages, status])

  // Focus the textarea (cursor at the end) on a pending focus request, possibly made before this
  // view mounted, once the Chat tab is visible.
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const visible = tab === "chat" && open && view === "main"
  useEffect(() => {
    if (!visible || !focusPending) return
    consumeFocus()
    const el = textareaRef.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [visible, focusPending, consumeFocus])

  // Leaving mid-reply (another video, or the card unmounting) stops the background stream.
  const busyRef = useRef(busy)
  busyRef.current = busy
  const stopRef = useRef(stop)
  stopRef.current = stop
  useEffect(
    () => () => {
      if (busyRef.current) void stopRef.current()
    },
    [],
  )

  const send = useCallback(
    (text: string, sendQuote: ChatQuote | null, web = false) => {
      const seconds = getVideoElement()?.currentTime
      const metadata: ChatMessageMetadata = {}
      if (attachTime && seconds !== undefined) metadata.at = Math.floor(seconds)
      if (sendQuote) metadata.quote = sendQuote
      // A deeper question also turns Research mode on, so follow-ups keep searching.
      if (web && researchSupported) setResearch(true)
      const lookup = researchOn || (web && researchSupported)
      if (lookup) metadata.web = true
      pinnedRef.current = true
      webRef.current = web
      void sendMessage({ text, metadata })
      if (shouldClearDraft(text, draft)) setDraft("")
      setQuote(null)
      setAttachTime(false)
    },
    [
      attachTime,
      draft,
      sendMessage,
      setDraft,
      setQuote,
      setAttachTime,
      researchOn,
      researchSupported,
    ],
  )

  const ask = useCallback((text: string) => send(text, quote), [send, quote])

  const rows = useMemo(() => chunkBySentences(context.transcript), [context.transcript])
  const videoId = context.metadata.videoId
  const seenExplain = useRef(0)
  const seenAsk = useRef(0)
  useEffect(() => {
    if (explain.nonce === 0 || explain.videoId !== videoId || seenExplain.current === explain.nonce)
      return
    if (busy) return
    seenExplain.current = explain.nonce
    const atMs = Math.round((getVideoElement()?.currentTime ?? 0) * 1000)
    send(buildMomentMessage(context, atMs, summary.text), null)
  }, [explain, videoId, busy, context, summary.text, send])
  useEffect(() => {
    if (
      pendingAsk.nonce === 0 ||
      pendingAsk.videoId !== videoId ||
      seenAsk.current === pendingAsk.nonce
    )
      return
    if (busy) return
    seenAsk.current = pendingAsk.nonce
    send(pendingAsk.text, null, pendingAsk.web)
  }, [pendingAsk, videoId, busy, send])
  const explainNow = (ms: number) => {
    const row = rows[Math.max(findActiveIndex(rows, ms), 0)]
    const nowQuote = row
      ? {
          seconds: Math.floor(row.startMs / 1000),
          text: displayText(row.text, settings.removeFillers),
        }
      : null
    send(EXPLAIN_NOW_PROMPT, nowQuote)
  }

  const messagesRef = useRef(messages)
  messagesRef.current = messages
  const onStop = async () => {
    stoppingRef.current = true
    stopMarkedRef.current = false
    try {
      await stop()
    } finally {
      stoppingRef.current = false
    }
    // Stopped before the request produced anything, so onFinish never ran: mark it here.
    if (stopMarkedRef.current || clearingRef.current) return
    const next = markStopped(messagesRef.current, newMessageId)
    if (next === messagesRef.current) return
    setMessages(next)
    save(next, latest.current.title).catch((e: unknown) => console.error("Failed to save chat", e))
  }

  const onFeedback = (id: string) => {
    const next = messages.map((m) =>
      m.id === id
        ? withMetadata(m, { feedback: messageMeta(m).feedback === "up" ? undefined : "up" })
        : m,
    )
    setMessages(next)
    save(next, title).catch((e: unknown) => console.error("Failed to save chat", e))
  }

  const onCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast("Copied"),
      () => toast("Couldn't copy"),
    )
  }

  // The stored thread was removed elsewhere (Settings › Clear chat history): drop the open one
  // too, so it is neither shown nor re-saved by a later reply or feedback.
  const hadStored = useRef(hasStored)
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs only when the stored entry goes away
  useEffect(() => {
    const had = hadStored.current
    hadStored.current = hasStored
    if (!had || hasStored || clearingRef.current) return
    clearError()
    if (busy) {
      clearingRef.current = true
      void stop().finally(() => {
        clearingRef.current = false
        setMessages([])
      })
    }
    setMessages([])
  }, [hasStored])

  // New chat (tab-row button): drop the thread and its stored copy.
  const handledNewChat = useRef(newChatToken)
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs only when New is requested
  useEffect(() => {
    if (handledNewChat.current === newChatToken) return
    handledNewChat.current = newChatToken
    clearingRef.current = true
    if (busy) void stop()
    clearError()
    setMessages([])
    setDraft("")
    setQuote(null)
    setAttachTime(false)
    setResearch(false)
    clear()
      .catch((e: unknown) => console.error("Failed to clear chat", e))
      .finally(() => {
        clearingRef.current = false
      })
  }, [newChatToken])

  const explainMoment = () => {
    const atMs = Math.round((getVideoElement()?.currentTime ?? 0) * 1000)
    send(buildMomentMessage(context, atMs, summary.text), null)
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center border-b px-[12px] py-[8px]">
        <TutorPill mode={choice.mode} level={choice.level} onChange={saveChoice} />
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-[16px]">
        <div className="recap-reading">
          {messages.length === 0 && !busy ? (
            <ChatEmptyState
              suggestions={pickSuggestions(summary.parsed.questions)}
              onExplainNow={explainNow}
              onAsk={ask}
            />
          ) : (
            <MessageList
              messages={messages}
              status={status}
              error={error}
              onCopy={onCopy}
              onRegenerate={() => void regenerate()}
              onFeedback={onFeedback}
              onRetry={() => void regenerate()}
              onDeepen={(text) => send(buildDeeperMessage(text.slice(0, 700)), null, true)}
            />
          )}
        </div>
      </div>
      <Composer
        draft={draft}
        onDraft={setDraft}
        quote={quote}
        onClearQuote={() => setQuote(null)}
        attachTime={attachTime}
        onToggleAttach={() => setAttachTime(!attachTime)}
        research={researchOn}
        researchSupported={researchSupported}
        onToggleResearch={() => setResearch(!researchOn)}
        busy={busy}
        onSend={() => ask(draft.trim())}
        onStop={() => void onStop()}
        onExplainMoment={explainMoment}
        modelPicker={<ModelPicker />}
        textareaRef={textareaRef}
      />
    </div>
  )
}
