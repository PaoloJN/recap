export type YouTubeTheme = "light" | "dark"

export function getYouTubeTheme(doc: Document = document): YouTubeTheme {
  return doc.documentElement.hasAttribute("dark") ? "dark" : "light"
}

export function watchYouTubeTheme(
  cb: (t: YouTubeTheme) => void,
  doc: Document = document,
): () => void {
  let last = getYouTubeTheme(doc)
  const observer = new MutationObserver(() => {
    const next = getYouTubeTheme(doc)
    if (next === last) return
    last = next
    cb(next)
  })
  observer.observe(doc.documentElement, { attributes: true, attributeFilter: ["dark"] })
  return () => observer.disconnect()
}
