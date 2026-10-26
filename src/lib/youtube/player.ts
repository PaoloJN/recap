const VIDEO_SELECTOR = "video.html5-main-video"
const RETRY_MS = 500

export function getVideoElement(doc: Document = document): HTMLVideoElement | null {
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
