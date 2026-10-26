import { MessageSquare } from "lucide-react"
import { ConversationEmptyState } from "@/components/ai-elements/conversation"
import { Button } from "@/components/ui/button"

export const STARTER_QUESTIONS: string[] = [
  "What is this video about?",
  "What are the key takeaways?",
  "Summarize the main arguments with timestamps",
  "What did they say about …?",
]

export interface ChatEmptyStateProps {
  onAsk: (text: string) => void
  onPrefill: (text: string) => void
}

/** "What did they say about …?" becomes "What did they say about " so the user can finish it. */
function toPrefill(question: string): string {
  return question.replace(/\s*…\??$/, " ")
}

export function ChatEmptyState({ onAsk, onPrefill }: ChatEmptyStateProps) {
  return (
    <ConversationEmptyState>
      <MessageSquare className="size-6 text-muted-foreground" />
      <h3 className="text-sm font-medium">Ask about this video</h3>
      <div className="flex flex-wrap justify-center gap-2">
        {STARTER_QUESTIONS.map((q) => {
          const prefill = q.includes("…")
          return (
            <Button
              key={q}
              variant="outline"
              size="sm"
              className="h-auto whitespace-normal py-1.5 text-left"
              onClick={() => (prefill ? onPrefill(toPrefill(q)) : onAsk(q))}
            >
              {q}
            </Button>
          )
        })}
      </div>
    </ConversationEmptyState>
  )
}
