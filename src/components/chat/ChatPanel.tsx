import { useChat } from "@ai-sdk/react"
import type { UIMessage } from "ai"
import { RefreshCw, Trash2 } from "lucide-react"
import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef } from "react"
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import { Message, MessageContent } from "@/components/ai-elements/message"
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  usePromptInputController,
} from "@/components/ai-elements/prompt-input"
import { Markdown } from "@/components/markdown/Markdown"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { PortChatTransport } from "@/lib/transport"
import type { ModelSelection, VideoContext } from "@/lib/types"
import { ChatEmptyState } from "./ChatEmptyState"
import { useChatHistory } from "./useChatHistory"

export interface ChatPanelProps {
  context: VideoContext
  selection: ModelSelection
}

export function ChatPanel({ context, selection }: ChatPanelProps) {
  const videoId = context.metadata.videoId
  const { initialMessages, ready, save, clear } = useChatHistory(videoId)

  if (!ready) {
    return (
      <div className="flex h-[460px] flex-col gap-2 p-4" role="status" aria-label="Loading chat">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    )
  }

  return (
    <PromptInputProvider key={videoId}>
      <ChatView
        videoId={videoId}
        context={context}
        selection={selection}
        initialMessages={initialMessages}
        save={save}
        clear={clear}
      />
    </PromptInputProvider>
  )
}

interface ChatViewProps extends ChatPanelProps {
  videoId: string
  initialMessages: UIMessage[] | undefined
  save: (messages: UIMessage[]) => Promise<void>
  clear: () => Promise<void>
}

function ChatView({ videoId, context, selection, initialMessages, save, clear }: ChatViewProps) {
  const ctxRef = useRef(context)
  const selectionRef = useRef(selection)
  useEffect(() => {
    ctxRef.current = context
  }, [context])
  useEffect(() => {
    selectionRef.current = selection
  }, [selection])

  // Built once per mounted view (the view is keyed by videoId); refs carry the latest settings.
  const transport = useMemo(
    () =>
      new PortChatTransport(() => ({ context: ctxRef.current, selection: selectionRef.current })),
    [],
  )

  // Set while Clear is in flight so the abort-triggered onFinish cannot re-save the cleared chat.
  const clearingRef = useRef(false)

  const { messages, sendMessage, status, stop, setMessages, error, regenerate, clearError } =
    useChat({
      id: videoId,
      messages: initialMessages,
      transport,
      onFinish: ({ messages: finished, isError }) => {
        if (isError || clearingRef.current) return
        save(finished).catch((e: unknown) => console.error("Failed to save chat", e))
      },
    })

  const controller = usePromptInputController()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const busy = status === "submitted" || status === "streaming"

  const ask = useCallback((text: string) => void sendMessage({ text }), [sendMessage])

  const prefill = useCallback(
    (text: string) => {
      controller.textInput.setInput(text)
      requestAnimationFrame(() => {
        const el = textareaRef.current
        if (!el) return
        el.focus()
        el.setSelectionRange(el.value.length, el.value.length)
      })
    },
    [controller.textInput],
  )

  const onSubmit = ({ text }: PromptInputMessage) => {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    ask(trimmed)
  }

  // While generating, Enter must not submit (and clear) the draft; the button is Stop then.
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (busy && e.key === "Enter" && !e.shiftKey) e.preventDefault()
  }

  const onClear = () => {
    clearingRef.current = true
    if (busy) void stop()
    clearError()
    setMessages([])
    clear()
      .catch((e: unknown) => console.error("Failed to clear chat", e))
      .finally(() => {
        clearingRef.current = false
      })
  }

  return (
    <div className="flex h-[460px] flex-col">
      {messages.length > 0 && (
        <div className="flex justify-end px-2 pt-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={onClear}>
                  <Trash2 />
                  Clear chat
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete this video's chat history</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      <Conversation className="min-h-0">
        <ConversationContent className="gap-4">
          {messages.length === 0 ? (
            <ChatEmptyState onAsk={ask} onPrefill={prefill} />
          ) : (
            messages.map((m) => (
              <Message key={m.id} from={m.role}>
                <MessageContent>
                  {m.parts.map((part, i) => {
                    if (part.type !== "text") return null
                    const key = `${m.id}-${i}`
                    return m.role === "assistant" ? (
                      <Markdown key={key}>{part.text}</Markdown>
                    ) : (
                      <p key={key} className="whitespace-pre-wrap">
                        {part.text}
                      </p>
                    )
                  })}
                </MessageContent>
              </Message>
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {error && (
        <div className="flex items-center justify-between gap-2 px-4 py-2 text-sm text-destructive">
          <span role="alert" className="min-w-0 break-words">
            {error.message}
          </span>
          <Button variant="ghost" size="sm" onClick={() => void regenerate()}>
            <RefreshCw />
            Retry
          </Button>
        </div>
      )}

      <div className="p-2">
        <PromptInput onSubmit={onSubmit}>
          <PromptInputBody>
            <PromptInputTextarea
              ref={textareaRef}
              placeholder="Ask about the video…"
              onKeyDown={onKeyDown}
            />
          </PromptInputBody>
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} onStop={stop} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  )
}
