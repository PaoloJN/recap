import { genericSource } from "./generic"
import type { VideoSource } from "./types"
import { youtubeSource } from "./youtube"

let active: VideoSource = youtubeSource

export function setActiveSource(source: VideoSource): void {
  active = source
}

export function getActiveSource(): VideoSource {
  return active
}

export function resetActiveSource(): void {
  active = youtubeSource
}

/** Used when a granted origin is not one of the built-in courses. */
export function activeOrGeneric(url: string, builtin: VideoSource | null): VideoSource {
  return builtin ?? (genericSource.match(url) ? genericSource : youtubeSource)
}
