import { useRef, useState } from "react"
import { largeButton, primaryButton, secondaryButton } from "@/components/summary/buttons"
import { useSeek } from "@/hooks/useSeek"
import type { Settings } from "@/lib/storage"
import { formatMs } from "@/lib/timestamps"
import { openStream, readTextFromUIStream } from "@/lib/transport"
import { gradeChoice, parseGrades, parseQuiz, shortAnswers } from "@/lib/tutor/quiz"
import type { GradeResult, QuizQuestion } from "@/lib/tutor/types"
import type { ModelSelection, VideoContext } from "@/lib/types"
import { cn } from "@/lib/utils"

type Status = "idle" | "streaming" | "ready" | "grading" | "graded" | "error"

export function QuizPanel({
  ctx,
  selection,
  settings,
}: {
  ctx: VideoContext
  selection: ModelSelection
  settings: Settings
}) {
  const [status, setStatus] = useState<Status>("idle")
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [picks, setPicks] = useState<Record<string, number>>({})
  const [written, setWritten] = useState<Record<string, string>>({})
  const [grades, setGrades] = useState<Record<string, GradeResult>>({})
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const seek = useSeek()

  const task = {
    context: ctx,
    selection,
    language: settings.language,
    customInstructions: settings.customInstructions,
    tutor: { mode: settings.tutorMode, level: settings.tutorLevel },
    role: settings.role,
    reasoningEffort: settings.reasoningEffort,
  }

  const generate = () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setStatus("streaming")
    setError(null)
    setGrades({})
    void (async () => {
      try {
        const text = await readTextFromUIStream(
          openStream({ kind: "quiz", ...task }, { signal: controller.signal }),
        )
        if (controller.signal.aborted) return
        const parsed = parseQuiz(text)
        if (!parsed) {
          setError("Không đọc được câu hỏi.")
          setStatus("error")
          return
        }
        setQuestions(parsed)
        setPicks({})
        setWritten({})
        setStatus("ready")
      } catch (err) {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : "Không tạo được quiz.")
        setStatus("error")
      }
    })()
  }

  const grade = () => {
    const next: Record<string, GradeResult> = {}
    for (const question of questions) {
      if (question.kind !== "choice") continue
      const picked = picks[question.id]
      const correct = picked !== undefined && gradeChoice(question, picked)
      next[question.id] = {
        id: question.id,
        correct,
        explanation: correct ? "Đúng." : question.why,
      }
    }
    const shorts = shortAnswers(questions, written)
    if (shorts.length === 0) {
      setGrades(next)
      setStatus("graded")
      return
    }
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setStatus("grading")
    void (async () => {
      try {
        const text = await readTextFromUIStream(
          openStream({ kind: "grade", ...task, answers: shorts }, { signal: controller.signal }),
        )
        if (controller.signal.aborted) return
        const parsed = parseGrades(text)
        if (!parsed) {
          setError("Không chấm được câu tự luận.")
          setGrades(next)
          setStatus("graded")
          return
        }
        for (const item of parsed) next[item.id] = item
        setGrades(next)
        setStatus("graded")
      } catch (err) {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : "Không chấm được câu tự luận.")
        setGrades(next)
        setStatus("graded")
      }
    })()
  }

  return (
    <div className="flex flex-col gap-[16px] p-[16px]">
      <button
        type="button"
        className={cn(primaryButton, largeButton, "w-fit")}
        disabled={status === "streaming" || status === "grading"}
        onClick={generate}
      >
        {status === "streaming" ? "Đang soạn…" : "Tạo 5 câu"}
      </button>
      {error ? (
        <p role="alert" className="text-[13px] leading-[19px]">
          {error}
        </p>
      ) : null}
      {questions.length > 0 ? (
        <ol className="flex flex-col gap-[16px]">
          {questions.map((question, index) => {
            const result = grades[question.id]
            const wrong = result && !result.correct
            return (
              <li key={question.id} className="flex flex-col gap-[8px]">
                <p className="text-body text-card-foreground">
                  {index + 1}. {question.prompt}
                </p>
                {question.kind === "choice" ? (
                  <div className="flex flex-col gap-[4px]">
                    {question.choices.map((choice, choiceIndex) => (
                      <label key={choice} className="flex items-start gap-[8px] text-[13px]">
                        <input
                          type="radio"
                          name={question.id}
                          checked={picks[question.id] === choiceIndex}
                          onChange={() =>
                            setPicks((cur) => ({ ...cur, [question.id]: choiceIndex }))
                          }
                        />
                        <span>{choice}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <textarea
                    aria-label={question.prompt}
                    value={written[question.id] ?? ""}
                    onChange={(event) =>
                      setWritten((cur) => ({ ...cur, [question.id]: event.target.value }))
                    }
                    className="min-h-[72px] rounded-[8px] border bg-background p-[8px] text-[13px]"
                  />
                )}
                {result ? (
                  <p
                    className={cn(
                      "text-[13px]",
                      wrong ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {result.correct ? "Đúng." : "Chưa đúng."} {result.explanation}
                  </p>
                ) : null}
                {wrong ? (
                  <button
                    type="button"
                    className="w-fit font-mono text-[12px] text-link"
                    onClick={() => seek(question.seconds)}
                  >
                    Xem lại {formatMs(question.seconds * 1000)}
                  </button>
                ) : null}
              </li>
            )
          })}
        </ol>
      ) : null}
      {questions.length > 0 ? (
        <button
          type="button"
          className={cn(secondaryButton, largeButton, "w-fit")}
          disabled={status === "grading" || status === "streaming"}
          onClick={grade}
        >
          {status === "grading" ? "Đang chấm…" : "Chấm bài"}
        </button>
      ) : null}
    </div>
  )
}
