export function getVideoIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.pathname !== "/watch") return null
    return u.searchParams.get("v") || null
  } catch {
    return null
  }
}

export function onVideoChange(
  cb: (videoId: string | null) => void,
  doc: Document = document,
): () => void {
  let last: string | null | undefined
  const emit = () => {
    const id = getVideoIdFromUrl(doc.location.href)
    if (id === last) return
    last = id
    cb(id)
  }
  doc.addEventListener("yt-navigate-finish", emit)
  emit()
  return () => doc.removeEventListener("yt-navigate-finish", emit)
}
