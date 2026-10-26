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
  /** Bumped by `requestFocus`; the composer focuses when it changes. */
  focusToken: number
  requestFocus(): void
}

const ChatDraftContext = createContext<ChatDraft | null>(null)

export function ChatDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState("")
  const [quote, setQuote] = useState<ChatQuote | null>(null)
  const [attachTime, setAttachTime] = useState(false)
  const [focusToken, setFocusToken] = useState(0)
  const requestFocus = useCallback(() => setFocusToken((t) => t + 1), [])

  const value = useMemo<ChatDraft>(
    () => ({
      draft,
      setDraft,
      quote,
      setQuote,
      attachTime,
      setAttachTime,
      focusToken,
      requestFocus,
    }),
    [draft, quote, attachTime, focusToken, requestFocus],
  )
  return <ChatDraftContext.Provider value={value}>{children}</ChatDraftContext.Provider>
}

export function useChatDraft(): ChatDraft {
  const value = useContext(ChatDraftContext)
  if (!value) throw new Error("useChatDraft must be used inside a ChatDraftProvider")
  return value
}
