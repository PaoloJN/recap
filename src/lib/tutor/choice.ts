import type { VideoType } from "@/lib/prompts/video-type"
import type { TutorLevel, TutorMode } from "./types"

export interface TutorChoice {
  mode: TutorMode
  level: TutorLevel
}

/** Built-in chat mode when this video type has no saved choice. */
export function defaultTutorMode(type: VideoType): TutorMode {
  if (type === "course-lecture") return "explain"
  if (type === "strategy-talk") return "socratic"
  return "qa"
}

export function tutorChoice(
  type: VideoType | null,
  saved: Partial<Record<VideoType, TutorChoice>> | undefined,
): TutorChoice {
  const key: VideoType = type ?? "other"
  const found = saved?.[key]
  if (found) return found
  return { mode: defaultTutorMode(key), level: "engineer" }
}
