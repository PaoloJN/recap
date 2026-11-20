import type { SourceTranscript } from "./types"
import { parseVtt } from "./vtt"

export interface CueLike {
  startTime: number
  endTime: number
  text: string
}

export interface TrackLike {
  kind: string
  label?: string
  language?: string
  mode?: TextTrackMode
  cues?: ArrayLike<CueLike> | null
  src?: string | null
}

const CAPTION_KINDS = new Set(["captions", "subtitles"])

function isAsr(track: TrackLike): boolean {
  const label = `${track.label ?? ""} ${track.src ?? ""}`.toLowerCase()
  return label.includes("auto") || label.includes("asr")
}

function fromCues(track: TrackLike): SourceTranscript | null {
  const cues = track.cues
  if (!cues || cues.length === 0) return null
  const segments = []
  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i]
    if (!cue) continue
    const text = cue.text.replace(/\n+/g, " ").trim()
    if (!text) continue
    segments.push({ start: cue.startTime, end: cue.endTime, text })
  }
  if (segments.length === 0) return null
  return { segments, isAsr: isAsr(track), language: track.language || "und" }
}

/**
 * Captions from `video.textTracks` (mode forced to `hidden` so the browser loads cues) and then
 * from `<track src>` VTT files. Returns null when nothing is available.
 */
export async function transcriptFromTracks(
  tracks: TrackLike[],
  fetchVtt: (src: string) => Promise<string> = (src) =>
    fetch(src, { credentials: "include" }).then((res) => {
      if (!res.ok) throw new Error(`vtt HTTP ${res.status}`)
      return res.text()
    }),
  waitForCues: (track: TrackLike) => Promise<void> = async (track) => {
    if (track.mode === "disabled") track.mode = "hidden"
    if (track.cues && track.cues.length > 0) return
    await new Promise((resolve) => setTimeout(resolve, 0))
  },
): Promise<SourceTranscript | null> {
  const captionTracks = tracks.filter(
    (track) => CAPTION_KINDS.has(track.kind) || Boolean(track.src),
  )
  const manual = captionTracks.filter((track) => !isAsr(track))
  const ordered = manual.length > 0 ? [...manual, ...captionTracks.filter(isAsr)] : captionTracks
  for (const track of ordered) {
    if (track.mode === "disabled") track.mode = "hidden"
    await waitForCues(track)
    const ready = fromCues(track)
    if (ready) return ready
    if (!track.src) continue
    try {
      const segments = parseVtt(await fetchVtt(track.src))
      if (segments.length > 0) {
        return { segments, isAsr: isAsr(track), language: track.language || "und" }
      }
    } catch {
      // try the next track
    }
  }
  return null
}

/** Read the video's text tracks and `<track>` elements into the shape the parser accepts. */
export function tracksFromVideo(video: HTMLVideoElement): TrackLike[] {
  const fromText: TrackLike[] = []
  const list = video.textTracks
  for (let i = 0; i < list.length; i++) {
    const track = list[i]
    if (!track) continue
    const cues: CueLike[] = []
    const listCues = track.cues
    if (listCues) {
      for (let cueIndex = 0; cueIndex < listCues.length; cueIndex++) {
        const cue = listCues[cueIndex]
        if (!cue || !("text" in cue) || typeof cue.text !== "string") continue
        cues.push({ startTime: cue.startTime, endTime: cue.endTime, text: cue.text })
      }
    }
    fromText.push({
      kind: track.kind,
      label: track.label,
      language: track.language,
      mode: track.mode,
      cues,
    })
  }
  const elements = video.querySelectorAll("track")
  const fromElements: TrackLike[] = []
  for (const el of elements) {
    if (!(el instanceof HTMLTrackElement)) continue
    fromElements.push({
      kind: el.kind || "subtitles",
      label: el.label,
      language: el.srclang,
      src: el.src || el.getAttribute("src"),
    })
  }
  return [...fromText, ...fromElements]
}
