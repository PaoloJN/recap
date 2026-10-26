import { useChat } from "@ai-sdk/react"
import type { UIMessage } from "ai"
import { useCallback, useEffect, useMemo, useRef } from "react"
import { usePanelNav } from "@/components/shell/NavigationContext"
import { useToast } from "@/components/shell/ToastContext"
import { useSummaryContext } from "@/components/summary/SummaryContext"
import { Skeleton } from "@/components/ui/skeleton"
import { useSettings } from "@/hooks/useSettings"
import type { VideoState } from "@/hooks/useVideo"
import { DEFAULT_SETTINGS } from "@/lib/storage"
import { chunkBySentences, findActiveIndex } from "@/lib/transcript/parse"
import { displayText } from "@/lib/transcript/text"
import { PortChatTransport } from "@/lib/transport"
import type { ChatMessageMetadata, ModelSelection, VideoContext } from "@/lib/types"
import { getVideoElement } from "@/lib/youtube/player"
import { type ChatQuote, useChatDraft } from "./ChatDraftContext"
import { ChatEmptyState, pickSuggestions } from "./ChatEmptyState"
import { Composer } from "./Composer"
import { MessageList, messageMeta } from "./MessageList"
import { ModelPicker } from "./ModelPicker"
import { markStopped, shouldClearDraft, withMetadata } from "./thread"
import { useChatHistory } from "./useChatHistory"

const newMessageId = () => crypto.randomUUID()
const EXPLAIN_NOW_PROMPT = "Explain what's happening here."
/** Within this distance of the bottom, new content keeps the list pinned to the bottom. */
const STICK_PX = 40

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
export function ChatPanel({ video }: { video: VideoState }) {
  const context = video.context
  const videoId = context?.metadata.videoId ?? ""
  const history = useChatHistory(videoId)
  if (!context || !history.ready) return <ChatSkeleton />
  return (
    <ChatView
      key={videoId}
      context={context}
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
  title: string | undefined
  initialMessages: UIMessage[] | undefined
  /** Whether storage holds a thread for this video; going false means it was cleared elsewhere. */
  hasStored: boolean
  save(messages: UIMessage[], title?: string): Promise<void>
  clear(): Promise<void>
}

function ChatView({ context, title, initialMessages, hasStored, save, clear }: ChatViewProps) {
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
  } = useChatDraft()

  const selection = useMemo<ModelSelection>(
    () => ({ provider: settings.provider, model: settings.models[settings.provider] }),
    [settings.provider, settings.models],
  )

  // The transport is built once per view (keyed by video); refs carry the latest values.
  const latest = useRef({ context, selection, language: settings.language, title })
  latest.current = { context, selection, language: settings.language, title }
  const transport = useMemo(
    () =>
      new PortChatTransport(() => ({
        context: latest.current.context,
        selection: latest.current.selection,
        language: latest.current.language,
      })),
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
  const onScroll = () => {
    const el = scrollRef.current
    if (el) pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_PX
  }
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
    (text: string, sendQuote: ChatQuote | null) => {
      const seconds = getVideoElement()?.currentTime
      const metadata: ChatMessageMetadata = {}
      if (attachTime && seconds !== undefined) metadata.at = Math.floor(seconds)
      if (sendQuote) metadata.quote = sendQuote
      pinnedRef.current = true
      void sendMessage({ text, metadata })
      if (shouldClearDraft(text, draft)) setDraft("")
      setQuote(null)
      setAttachTime(false)
    },
    [attachTime, draft, sendMessage, setDraft, setQuote, setAttachTime],
  )

  const ask = useCallback((text: string) => send(text, quote), [send, quote])

  const rows = useMemo(() => chunkBySentences(context.transcript), [context.transcript])
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
    clear()
      .catch((e: unknown) => console.error("Failed to clear chat", e))
      .finally(() => {
        clearingRef.current = false
      })
  }, [newChatToken])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto p-[16px]">
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
          />
        )}
      </div>
      <Composer
        draft={draft}
        onDraft={setDraft}
        quote={quote}
        onClearQuote={() => setQuote(null)}
        attachTime={attachTime}
        onToggleAttach={() => setAttachTime(!attachTime)}
        busy={busy}
        onSend={() => ask(draft.trim())}
        onStop={() => void onStop()}
        modelPicker={<ModelPicker />}
        textareaRef={textareaRef}
      />
    </div>
  )
}
