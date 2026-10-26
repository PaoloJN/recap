import type { CaptionTrack, Chapter, InnertubeConfig, WatchPageData } from "@/lib/types"
import { parseChaptersFromDescription, parseChaptersFromInitialData } from "./chapters"

const PLAYER_RE = /var ytInitialPlayerResponse\s*=\s*(\{.+?\});\s*var\s/s
const INITIAL_DATA_RE = /var ytInitialData\s*=\s*(\{.+?\});<\/script>/s
const YTCFG_RE = /ytcfg\.set\((\{.+?\})\);/gs

type Json = Record<string, unknown>

const obj = (v: unknown): Json => (v && typeof v === "object" ? (v as Json) : {})
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined)

function parseInnertube(html: string): InnertubeConfig {
  for (const m of html.matchAll(YTCFG_RE)) {
    const raw = m[1]
    if (!raw?.includes('"INNERTUBE_CONTEXT"')) continue
    try {
      const client = obj(obj(obj(JSON.parse(raw)).INNERTUBE_CONTEXT).client)
      return {
        client: {
          clientName: str(client.clientName) ?? "WEB",
          clientVersion: str(client.clientVersion) ?? "",
          hl: str(client.hl) ?? "en",
          gl: str(client.gl) ?? "US",
        },
      }
    } catch {
      // try the next match
    }
  }
  throw new Error("innertube context not found")
}

function parseTracks(player: Json): CaptionTrack[] {
  const raw = obj(obj(player.captions).playerCaptionsTracklistRenderer).captionTracks
  if (!Array.isArray(raw)) return []
  const tracks: CaptionTrack[] = []
  for (const item of raw) {
    const t = obj(item)
    const languageCode = str(t.languageCode)
    if (!languageCode) continue
    const name = obj(t.name)
    const label =
      str(name.simpleText) ?? str(obj(Array.isArray(name.runs) ? name.runs[0] : null).text)
    tracks.push({
      languageCode,
      name: label ?? languageCode,
      ...(t.kind === "asr" ? { kind: "asr" as const } : {}),
    })
  }
  return tracks
}

function parseChapters(html: string, description: string): Chapter[] {
  const raw = INITIAL_DATA_RE.exec(html)?.[1]
  if (raw) {
    try {
      const fromData = parseChaptersFromInitialData(JSON.parse(raw))
      if (fromData.length > 0) return fromData
    } catch {
      // fall back to the description
    }
  }
  return parseChaptersFromDescription(description)
}

export function parseWatchPage(html: string): WatchPageData {
  const match = PLAYER_RE.exec(html)
  if (!match?.[1]) throw new Error("player response not found")
  let player: Json
  try {
    player = obj(JSON.parse(match[1]))
  } catch {
    throw new Error("player response not found")
  }
  const details = obj(player.videoDetails)
  const innertube = parseInnertube(html)
  const description = str(details.shortDescription) ?? ""
  return {
    metadata: {
      videoId: str(details.videoId) ?? "",
      title: str(details.title) ?? "",
      author: str(details.author) ?? "",
      durationSeconds: Number(details.lengthSeconds) || 0,
      description,
    },
    captionTracks: parseTracks(player),
    innertube,
    chapters: parseChapters(html, description),
  }
}

export function pickCaptionTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  const manual = tracks.filter((t) => t.kind !== "asr")
  const pool = manual.length > 0 ? manual : tracks
  return pool.find((t) => t.languageCode === "en") ?? pool[0] ?? null
}

export async function fetchWatchPage(
  videoId: string,
  fetchFn: typeof fetch = fetch,
): Promise<WatchPageData> {
  const res = await fetchFn(`https://www.youtube.com/watch?v=${videoId}`, {
    credentials: "same-origin",
  })
  if (!res.ok) throw new Error(`watch page HTTP ${res.status}`)
  return parseWatchPage(await res.text())
}
