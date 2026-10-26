import { parseTimestamp } from "@/lib/timestamps"
import type {
  InnertubeConfig,
  TranscriptSegment,
  TranscriptStatus,
  WatchPageData,
} from "@/lib/types"
import { pickCaptionTrack } from "@/lib/youtube/watch-page"
import { encodePanelParams, TRANSCRIPT_PANEL_ID } from "./params"
import { parseGetPanelResponse } from "./parse"

// DOM selectors (spike notes section 4). Update here when YouTube changes its markup.
export const SEL_DESCRIPTION_EXPAND = "#description-inline-expander #expand"
export const SEL_SHOW_TRANSCRIPT = 'button[aria-label="Show transcript"]'
export const SEL_PANELS = [
  'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]',
  `ytd-engagement-panel-section-list-renderer[target-id="${TRANSCRIPT_PANEL_ID}"]`,
]
export const SEL_ROW_LEGACY = "ytd-transcript-segment-renderer"
export const SEL_TIME_LEGACY = ".segment-timestamp"
export const SEL_TEXT_LEGACY = ".segment-text"
export const SEL_ROW_MODERN = "transcript-segment-view-model"
export const SEL_TIME_MODERN = ".ytwTranscriptSegmentViewModelTimestamp"
export const SEL_TEXT_MODERN = "span[role=text]"
export const SEL_PANEL_CLOSE = '#visibility-button button, button[aria-label="Close"]'

const POLL_INTERVAL_MS = 100
const POLL_TIMEOUT_MS = 3000
const LAST_SEGMENT_MS = 5000

export async function fetchTranscriptViaInnertube(
  videoId: string,
  innertube: InnertubeConfig,
  durationMs: number,
  fetchFn: typeof fetch = fetch,
): Promise<TranscriptSegment[]> {
  const res = await fetchFn("https://www.youtube.com/youtubei/v1/get_panel?prettyPrint=false", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      context: { client: innertube.client },
      panelId: TRANSCRIPT_PANEL_ID,
      params: encodePanelParams(videoId),
    }),
  })
  if (!res.ok) throw new Error(`get_panel HTTP ${res.status}`)
  return parseGetPanelResponse(await res.json(), durationMs)
}

function isVisible(el: HTMLElement): boolean {
  return el.offsetParent !== null
}

function pickButton(doc: Document, selector: string): HTMLElement | null {
  const all = Array.from(doc.querySelectorAll<HTMLElement>(selector))
  return all.find(isVisible) ?? all[0] ?? null
}

function findPanel(doc: Document): Element | null {
  for (const sel of SEL_PANELS) {
    const el = doc.querySelector(sel)
    if (el) return el
  }
  return null
}

function findRows(panel: Element): { row: Element; time: string; text: string }[] {
  const variants = [
    [SEL_ROW_LEGACY, SEL_TIME_LEGACY, SEL_TEXT_LEGACY],
    [SEL_ROW_MODERN, SEL_TIME_MODERN, SEL_TEXT_MODERN],
  ] as const
  for (const [rowSel, timeSel, textSel] of variants) {
    const rows = Array.from(panel.querySelectorAll(rowSel))
    if (rows.length === 0) continue
    return rows.map((row) => ({
      row,
      time: row.querySelector(timeSel)?.textContent?.trim() ?? "",
      text: row.querySelector(textSel)?.textContent?.trim() ?? "",
    }))
  }
  return []
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export async function readTranscriptFromDomPanel(
  doc: Document = document,
): Promise<TranscriptSegment[]> {
  try {
    const expand = pickButton(doc, SEL_DESCRIPTION_EXPAND)
    if (expand && isVisible(expand)) expand.click()
    const button = pickButton(doc, SEL_SHOW_TRANSCRIPT)
    if (!button) return []
    button.click()

    let panel: Element | null = null
    let rows: ReturnType<typeof findRows> = []
    for (let waited = 0; ; waited += POLL_INTERVAL_MS) {
      panel = findPanel(doc)
      rows = panel ? findRows(panel) : []
      if (rows.length > 0 || waited >= POLL_TIMEOUT_MS) break
      await sleep(POLL_INTERVAL_MS)
    }
    if (!panel || rows.length === 0) return []

    const starts: { text: string; startMs: number }[] = []
    for (const r of rows) {
      const sec = parseTimestamp(r.time)
      if (sec === null || !r.text) continue
      starts.push({ text: r.text, startMs: sec * 1000 })
    }
    const segments = starts.map((s, i) => ({
      text: s.text,
      startMs: s.startMs,
      endMs: starts[i + 1]?.startMs ?? s.startMs + LAST_SEGMENT_MS,
    }))
    panel.querySelector<HTMLElement>(SEL_PANEL_CLOSE)?.click()
    return segments
  } catch {
    return []
  }
}

export async function loadTranscript(
  page: WatchPageData,
  fetchFn: typeof fetch = fetch,
  doc: Document = document,
  readDom: (doc?: Document) => Promise<TranscriptSegment[]> = readTranscriptFromDomPanel,
): Promise<TranscriptStatus> {
  const track = pickCaptionTrack(page.captionTracks)
  if (!track) return { state: "unavailable" }
  const language = track.languageCode

  let segments: TranscriptSegment[] = []
  try {
    segments = await fetchTranscriptViaInnertube(
      page.metadata.videoId,
      page.innertube,
      page.metadata.durationSeconds * 1000,
      fetchFn,
    )
  } catch {
    segments = []
  }
  if (segments.length > 0) return { state: "ready", segments, language }

  try {
    segments = await readDom(doc)
  } catch (e) {
    return { state: "error", message: e instanceof Error ? e.message : String(e) }
  }
  return segments.length > 0 ? { state: "ready", segments, language } : { state: "unavailable" }
}
