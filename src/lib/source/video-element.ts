/** The largest HTML5 video, which is the lecture rather than a thumbnail preview. */
export function largestVideo(doc: Document = document): HTMLVideoElement | null {
  const videos = [...doc.querySelectorAll("video")]
  if (videos.length === 0) return null
  return videos.reduce((best, video) => {
    const area = video.clientWidth * video.clientHeight
    const bestArea = best.clientWidth * best.clientHeight
    return area > bestArea ? video : best
  })
}

export function textOf(doc: Document, selector: string): string {
  return doc.querySelector(selector)?.textContent?.trim() ?? ""
}

export function metaContent(doc: Document, name: string): string {
  const el = doc.querySelector(`meta[name="${name}"]`)
  return el?.getAttribute("content")?.trim() ?? ""
}
