const VIDEO_SELECTOR = "video.html5-main-video"
const RETRY_MS = 500

/** Course adapters install this so seek and the playhead follow their `<video>`, not YouTube's. */
let videoResolver: ((doc: Document) => HTMLVideoElement | null) | null = null

export function setVideoResolver(
  resolver: ((doc: Document) => HTMLVideoElement | null) | null,
): void {
  videoResolver = resolver
}

export function getVideoElement(doc: Document = document): HTMLVideoElement | null {
  const resolved = videoResolver?.(doc)
  if (resolved) return resolved
  return doc.querySelector<HTMLVideoElement>(VIDEO_SELECTOR)
}

export function seekTo(seconds: number, doc: Document = document): void {
  const video = getVideoElement(doc)
  if (video) video.currentTime = seconds
}

export function onTimeUpdate(cb: (ms: number) => void, doc: Document = document): () => void {
  let video: HTMLVideoElement | null = null
  let timer: ReturnType<typeof setInterval> | undefined
  const handler = () => {
    if (video) cb(Math.round(video.currentTime * 1000))
  }
  const attach = (): boolean => {
    video = getVideoElement(doc)
    if (!video) return false
    video.addEventListener("timeupdate", handler)
    return true
  }
  if (!attach()) {
    timer = setInterval(() => {
      if (attach()) clearInterval(timer)
    }, RETRY_MS)
  }
  return () => {
    clearInterval(timer)
    video?.removeEventListener("timeupdate", handler)
  }
}

export interface PlayerState {
  ms: number
  paused: boolean
}

const PLAYER_EVENTS = ["timeupdate", "play", "pause", "seeked"] as const

export function onPlayerState(cb: (s: PlayerState) => void, doc: Document = document): () => void {
  let video: HTMLVideoElement | null = null
  let timer: ReturnType<typeof setInterval> | undefined
  const emit = () => {
    if (video) cb({ ms: Math.round(video.currentTime * 1000), paused: video.paused })
  }
  const attach = (): boolean => {
    video = getVideoElement(doc)
    if (!video) return false
    for (const e of PLAYER_EVENTS) video.addEventListener(e, emit)
    emit()
    return true
  }
  if (!attach()) {
    timer = setInterval(() => {
      if (attach()) clearInterval(timer)
    }, RETRY_MS)
  }
  return () => {
    clearInterval(timer)
    if (video) for (const e of PLAYER_EVENTS) video.removeEventListener(e, emit)
  }
}
