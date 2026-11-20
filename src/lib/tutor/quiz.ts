import { parseTimestamp } from "@/lib/timestamps"
import type { GradeResult, QuizQuestion } from "./types"

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function unwrapJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text)
  const body = (fenced?.[1] ?? text).trim()
  const start = body.indexOf("{")
  const arrayStart = body.indexOf("[")
  const useArray = arrayStart !== -1 && (start === -1 || arrayStart < start)
  const open = useArray ? arrayStart : start
  const closeChar = useArray ? "]" : "}"
  const close = body.lastIndexOf(closeChar)
  if (open === -1 || close <= open) return null
  try {
    return JSON.parse(body.slice(open, close + 1))
  } catch {
    return null
  }
}

function parseQuestion(value: unknown, index: number): QuizQuestion | null {
  const raw = asRecord(value)
  if (!raw) return null
  const prompt = asString(raw.prompt)
  const why = asString(raw.why)
  const seconds = parseTimestamp(asString(raw.timestamp))
  if (!prompt || !why || seconds === null) return null
  const id = asString(raw.id) || `q${index + 1}`
  if (raw.kind === "short") {
    const rubric = asString(raw.rubric)
    if (!rubric) return null
    return { id, kind: "short", prompt, rubric, why, seconds }
  }
  if (raw.kind !== "choice" || !Array.isArray(raw.choices)) return null
  const choices = raw.choices.map(asString).filter(Boolean)
  const answer = raw.answer
  if (choices.length < 2 || typeof answer !== "number" || !Number.isInteger(answer)) return null
  if (answer < 0 || answer >= choices.length) return null
  return { id, kind: "choice", prompt, choices, answer, why, seconds }
}

export function parseQuiz(text: string): QuizQuestion[] | null {
  const json = unwrapJson(text)
  const list = Array.isArray(json) ? json : asRecord(json)?.questions
  if (!Array.isArray(list)) return null
  const questions = list
    .map((item, index) => parseQuestion(item, index))
    .filter((item): item is QuizQuestion => item !== null)
  return questions.length > 0 ? questions : null
}

export function gradeChoice(
  question: Extract<QuizQuestion, { kind: "choice" }>,
  picked: number,
): boolean {
  return picked === question.answer
}

export interface ShortAnswer {
  id: string
  prompt: string
  rubric: string
  answer: string
}

export function shortAnswers(
  questions: readonly QuizQuestion[],
  answers: Readonly<Record<string, string>>,
): ShortAnswer[] {
  return questions.flatMap((question) => {
    if (question.kind !== "short") return []
    return [
      {
        id: question.id,
        prompt: question.prompt,
        rubric: question.rubric,
        answer: answers[question.id]?.trim() ?? "",
      },
    ]
  })
}

export function parseGrades(text: string): GradeResult[] | null {
  const json = unwrapJson(text)
  const list = Array.isArray(json) ? json : asRecord(json)?.grades
  if (!Array.isArray(list)) return null
  const grades: GradeResult[] = []
  for (const item of list) {
    const raw = asRecord(item)
    if (!raw) continue
    const id = asString(raw.id)
    const explanation = asString(raw.explanation)
    if (!id || typeof raw.correct !== "boolean" || !explanation) continue
    grades.push({ id, correct: raw.correct, explanation })
  }
  return grades.length > 0 ? grades : null
}
