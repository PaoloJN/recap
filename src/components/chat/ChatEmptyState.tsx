import {
  ArrowBendDownRight,
  Clock,
  Exam,
  GraduationCap,
  type Icon,
  Notebook,
} from "@phosphor-icons/react"
import { usePlayer } from "@/hooks/usePlayer"
import { formatMs } from "@/lib/timestamps"

/** Used when the summary hasn't produced at least three follow-up questions. */
export const FALLBACK_SUGGESTIONS: string[] = [
  "What's the main takeaway?",
  "Summarize the key points with timestamps",
  "What should I remember from this?",
]

const QUICK: { icon: Icon; label: string; prompt: string }[] = [
  {
    icon: GraduationCap,
    label: "Explain simply",
    prompt: "Explain this video like I'm new to the topic",
  },
  { icon: Exam, label: "Quiz me", prompt: "Quiz me on this video with 3 questions" },
  {
    icon: Notebook,
    label: "Study notes",
    prompt: "Turn this video into study notes with timestamps",
  },
]

/** Three suggestions: the summary's questions when it has 3+, otherwise generic ones. */
export function pickSuggestions(questions: string[]): string[] {
  return questions.length >= 3 ? questions.slice(0, 3) : FALLBACK_SUGGESTIONS
}

const ROW =
  "flex w-full cursor-pointer items-center gap-[10px] rounded-[8px] px-[8px] py-[10px] text-left text-body text-card-foreground transition-colors duration-150 outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"

/** The only part of the start screen that re-renders with playback time. */
function ExplainNowRow({ onExplainNow }: { onExplainNow(ms: number): void }) {
  const { ms } = usePlayer()
  return (
    <button type="button" className={ROW} onClick={() => onExplainNow(ms)}>
      <Clock className="size-[15px] shrink-0 text-link" aria-hidden />
      <span className="flex-1">
        Explain what's happening at{" "}
        <span className="font-mono text-[13px] text-link">{formatMs(ms)}</span>
      </span>
    </button>
  )
}

export interface ChatEmptyStateProps {
  suggestions: string[]
  /** Quote the transcript line at `ms` and ask about it. */
  onExplainNow(ms: number): void
  onAsk(text: string): void
}

export function ChatEmptyState({ suggestions, onExplainNow, onAsk }: ChatEmptyStateProps) {
  return (
    <div className="flex min-h-full flex-col justify-end gap-[16px]">
      <div className="flex flex-col gap-[4px]">
        <h3 className="text-[16px] leading-[24px] font-medium text-foreground">
          Ask about this video
        </h3>
        <p className="text-[13px] leading-[19px] text-muted-foreground">
          Answers link to the moment they came from.
        </p>
      </div>
      <div className="-mx-[8px] flex flex-col">
        <ExplainNowRow onExplainNow={onExplainNow} />
        {suggestions.map((text) => (
          <button key={text} type="button" className={ROW} onClick={() => onAsk(text)}>
            <ArrowBendDownRight
              className="size-[15px] shrink-0 text-subtle-foreground"
              aria-hidden
            />
            <span className="flex-1">{text}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-[6px]">
        {QUICK.map(({ icon: QuickIcon, label, prompt }) => (
          <button
            key={label}
            type="button"
            onClick={() => onAsk(prompt)}
            className="flex h-[28px] cursor-pointer items-center gap-[6px] rounded-[8px] bg-secondary px-[10px] text-[12px] font-medium text-foreground transition-colors duration-150 outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <QuickIcon className="size-[14px] text-muted-foreground" aria-hidden />
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
