export type TutorMode = "qa" | "explain" | "socratic"
export type TutorLevel = "basic" | "engineer" | "expert"

export const TUTOR_MODES: readonly TutorMode[] = ["qa", "explain", "socratic"]
export const TUTOR_LEVELS: readonly TutorLevel[] = ["basic", "engineer", "expert"]

export const TUTOR_MODE_LABELS: Record<TutorMode, string> = {
  qa: "Hỏi đáp",
  explain: "Giảng giải",
  socratic: "Socratic",
}

export const TUTOR_LEVEL_LABELS: Record<TutorLevel, string> = {
  basic: "Cơ bản",
  engineer: "Kỹ sư",
  expert: "Chuyên gia",
}

export interface TutorSettings {
  mode: TutorMode
  level: TutorLevel
}

export interface Concept {
  name: string
  explanation: string
  why: string
  seconds: number
  related: string[]
  /** Concepts the viewer should know first. */
  prerequisites: string[]
}

export type QuizQuestion =
  | {
      id: string
      kind: "choice"
      prompt: string
      choices: string[]
      answer: number
      why: string
      seconds: number
    }
  | {
      id: string
      kind: "short"
      prompt: string
      rubric: string
      why: string
      seconds: number
    }

export interface GradeResult {
  id: string
  correct: boolean
  explanation: string
}
