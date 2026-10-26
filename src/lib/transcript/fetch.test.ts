import { describe, expect, it, vi } from "vitest"
import type { WatchPageData } from "@/lib/types"
import en from "./__fixtures__/get-panel.en.json"
import { fetchTranscriptViaInnertube, loadTranscript, readTranscriptFromDomPanel } from "./fetch"
import { encodePanelParams, TRANSCRIPT_PANEL_ID } from "./params"

const client = { clientName: "WEB", clientVersion: "2.0", hl: "en", gl: "US" }
const page = (captionTracks: WatchPageData["captionTracks"]): WatchPageData => ({
  metadata: { videoId: "Tn6-PIqc4UM", title: "t", author: "a", durationSeconds: 128 },
  captionTracks,
  innertube: { client },
})
const tracks = [{ languageCode: "en", name: "English" }]
const json = (body: unknown) => new Response(JSON.stringify(body))
const asFetch = (fn: unknown) => fn as typeof fetch
const emptyDoc = () => document.implementation.createHTMLDocument("x")

describe("fetchTranscriptViaInnertube", () => {
  it("posts the expected request", async () => {
    const fetchFn = vi.fn(async () => json(en))
    const segs = await fetchTranscriptViaInnertube("abc", { client }, 128000, asFetch(fetchFn))
    expect(segs.length).toBeGreaterThan(0)
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("https://www.youtube.com/youtubei/v1/get_panel?prettyPrint=false")
    expect(init.method).toBe("POST")
    expect(init.credentials).toBe("same-origin")
    expect(JSON.parse(init.body as string)).toEqual({
      context: { client },
      panelId: TRANSCRIPT_PANEL_ID,
      params: encodePanelParams("abc"),
    })
  })
  it("throws on non-2xx", async () => {
    const fetchFn = vi.fn(async () => new Response("", { status: 403 }))
    await expect(fetchTranscriptViaInnertube("a", { client }, 1, asFetch(fetchFn))).rejects.toThrow(
      "get_panel HTTP 403",
    )
  })
})

describe("loadTranscript", () => {
  it("ready with language of picked track", async () => {
    const fetchFn = vi.fn(async () => json(en))
    const res = await loadTranscript(page(tracks), asFetch(fetchFn), emptyDoc())
    expect(res.state).toBe("ready")
    if (res.state === "ready") {
      expect(res.language).toBe("en")
      expect(res.segments.length).toBeGreaterThan(0)
    }
    const body = JSON.parse(
      (fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
    )
    expect(Object.keys(body.context.client).sort()).toEqual([
      "clientName",
      "clientVersion",
      "gl",
      "hl",
    ])
  })
  it("unavailable with no caption tracks and no fetch", async () => {
    const fetchFn = vi.fn()
    const res = await loadTranscript(page([]), asFetch(fetchFn), emptyDoc())
    expect(res).toEqual({ state: "unavailable" })
    expect(fetchFn).not.toHaveBeenCalled()
  })
  it("unavailable on empty response and no DOM panel", async () => {
    const fetchFn = vi.fn(async () => json({ responseContext: {} }))
    expect(await loadTranscript(page(tracks), asFetch(fetchFn), emptyDoc())).toEqual({
      state: "unavailable",
    })
  })
  it("unavailable when fetch throws and DOM has no panel", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("net")
    })
    expect(await loadTranscript(page(tracks), asFetch(fetchFn), emptyDoc())).toEqual({
      state: "unavailable",
    })
  })
  it("error when fetch throws and DOM read throws", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("net")
    })
    const doc = {
      get querySelector(): never {
        throw new Error("boom")
      },
    } as unknown as Document
    // readTranscriptFromDomPanel swallows DOM errors, so inject a throwing reader via module mock below
    const res = await loadTranscript(page(tracks), asFetch(fetchFn), doc, async () => {
      throw new Error("dom exploded")
    })
    expect(res).toEqual({ state: "error", message: "dom exploded" })
  })
})

describe("readTranscriptFromDomPanel", () => {
  it("returns [] with no panel", async () => {
    expect(await readTranscriptFromDomPanel(emptyDoc())).toEqual([])
  })
  it("reads legacy rows and clicks Close", async () => {
    const doc = emptyDoc()
    doc.body.innerHTML = `
      <button aria-label="Show transcript">Show transcript</button>
      <ytd-engagement-panel-section-list-renderer target-id="engagement-panel-searchable-transcript">
        <ytd-engagement-panel-title-header-renderer><div id="visibility-button"><button aria-label="Close"></button></div></ytd-engagement-panel-title-header-renderer>
        <ytd-transcript-segment-renderer><div class="segment-timestamp"> 0:01 </div><div class="segment-text"> hello </div></ytd-transcript-segment-renderer>
        <ytd-transcript-segment-renderer><div class="segment-timestamp">0:05</div><div class="segment-text">world</div></ytd-transcript-segment-renderer>
      </ytd-engagement-panel-section-list-renderer>`
    const close = doc.querySelector('button[aria-label="Close"]') as HTMLElement
    const onClose = vi.fn()
    close.addEventListener("click", onClose)
    const segs = await readTranscriptFromDomPanel(doc)
    expect(segs).toEqual([
      { text: "hello", startMs: 1000, endMs: 5000 },
      { text: "world", startMs: 5000, endMs: 10000 },
    ])
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
