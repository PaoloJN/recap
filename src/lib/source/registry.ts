import { courseraSource } from "./coursera"
import { dlaiSource } from "./dlai"
import { genericSource } from "./generic"
import type { VideoSource } from "./types"
import { udemySource } from "./udemy"
import { youtubeSource } from "./youtube"

/** Built-in sites, most specific first. Generic is not included; it is opt-in per origin. */
export const BUILTIN_SOURCES: readonly VideoSource[] = [
  youtubeSource,
  udemySource,
  courseraSource,
  dlaiSource,
]

export const COURSE_MATCHES = [
  "*://www.udemy.com/course/*/learn/lecture/*",
  "*://www.coursera.org/learn/*/lecture/*",
  "*://learn.deeplearning.ai/courses/*",
] as const

export function sourceForUrl(url: string): VideoSource | null {
  return BUILTIN_SOURCES.find((source) => source.match(url)) ?? null
}

export function isBuiltinUrl(url: string): boolean {
  return sourceForUrl(url) !== null
}

export { genericSource }
