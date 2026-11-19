import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react"

export interface ChatQuote {
  seconds: number
  text: string
}

export interface ChatDraft {
  draft: string
  setDraft(v: string): void
  quote: ChatQuote | null
  setQuote(q: ChatQuote | null): void
  attachTime: boolean
  setAttachTime(v: boolean): void
  /**
   * Set by `requestFocus`; the composer focuses and calls `consumeFocus` once it is mounted and
   * visible, so a request made before the chat view exists is not lost. Cleared by `reset`.
   */
  focusPending: boolean
  requestFocus(): void
  consumeFocus(): void
  /** Whether the open chat thread has messages; drives the tab row's "New" button. */
  hasMessages: boolean
  setHasMessages(v: boolean): void
  /** Bumped by `requestNewChat`; the chat panel clears its thread when it changes. */
  newChatToken: number
  requestNewChat(): void
  /** Ask the chat to explain the current moment once it is mounted for this video. */
  explain: { nonce: number; videoId: string }
  requestExplain(videoId: string): void
  /** A prompt to send once chat is mounted. `web` asks for a web search on that turn. */
  ask: { nonce: number; videoId: string; text: string; web: boolean }
  requestAsk(videoId: string, text: string, web: boolean): void
  /** Clears draft, quote, attachTime and a pending focus request (on video change). */
  reset(): void
}

const ChatDraftContext = createContext<ChatDraft | null>(null)

export function ChatDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState("")
  const [quote, setQuote] = useState<ChatQuote | null>(null)
  const [attachTime, setAttachTime] = useState(false)
  const [focusPending, setFocusPending] = useState(false)
  const requestFocus = useCallback(() => setFocusPending(true), [])
  const consumeFocus = useCallback(() => setFocusPending(false), [])
  const [hasMessages, setHasMessages] = useState(false)
  const [newChatToken, setNewChatToken] = useState(0)
  const requestNewChat = useCallback(() => setNewChatToken((t) => t + 1), [])
  const [explain, setExplain] = useState({ nonce: 0, videoId: "" })
  const requestExplain = useCallback((videoId: string) => {
    setExplain((cur) => ({ nonce: cur.nonce + 1, videoId }))
  }, [])
  const [ask, setAsk] = useState({ nonce: 0, videoId: "", text: "", web: false })
  const requestAsk = useCallback((videoId: string, text: string, web: boolean) => {
    setAsk((cur) => ({ nonce: cur.nonce + 1, videoId, text, web }))
  }, [])
  const reset = useCallback(() => {
    setDraft("")
    setQuote(null)
    setAttachTime(false)
    setFocusPending(false)
    setExplain({ nonce: 0, videoId: "" })
    setAsk({ nonce: 0, videoId: "", text: "", web: false })
  }, [])

  const value = useMemo<ChatDraft>(
    () => ({
      draft,
      setDraft,
      quote,
      setQuote,
      attachTime,
      setAttachTime,
      focusPending,
      requestFocus,
      consumeFocus,
      hasMessages,
      setHasMessages,
      newChatToken,
      requestNewChat,
      explain,
      requestExplain,
      ask,
      requestAsk,
      reset,
    }),
    [
      draft,
      quote,
      attachTime,
      focusPending,
      requestFocus,
      consumeFocus,
      hasMessages,
      newChatToken,
      requestNewChat,
      explain,
      requestExplain,
      ask,
      requestAsk,
      reset,
    ],
  )
  return <ChatDraftContext.Provider value={value}>{children}</ChatDraftContext.Provider>
}

export function useChatDraft(): ChatDraft {
  const value = useContext(ChatDraftContext)
  if (!value) throw new Error("useChatDraft must be used inside a ChatDraftProvider")
  return value
}
