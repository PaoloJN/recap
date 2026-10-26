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
  chapters: [],
})
const tracks = [{ languageCode: "en", name: "English" }]
const json = (body: unknown) => new Response(JSON.stringify(body))
const asFetch = (fn: unknown) => fn as typeof fetch
const visible = () => true
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
  it("error when the real DOM reader throws inside the panel", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("net")
    })
    const doc = emptyDoc()
    doc.body.innerHTML = `
      <button aria-label="Show transcript"></button>
      <ytd-engagement-panel-section-list-renderer target-id="engagement-panel-searchable-transcript"></ytd-engagement-panel-section-list-renderer>`
    const panel = doc.querySelector("ytd-engagement-panel-section-list-renderer") as Element
    panel.querySelectorAll = () => {
      throw new Error("panel exploded")
    }
    const res = await loadTranscript(page(tracks), asFetch(fetchFn), doc, (d) =>
      readTranscriptFromDomPanel(d, visible),
    )
    expect(res).toEqual({ state: "error", message: "panel exploded" })
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
    const segs = await readTranscriptFromDomPanel(doc, visible)
    expect(segs).toEqual([
      { text: "hello", startMs: 1000, endMs: 5000 },
      { text: "world", startMs: 5000, endMs: 10000 },
    ])
    expect(onClose).toHaveBeenCalledTimes(1)
  })
  it("reads modern rows and clicks Close", async () => {
    const doc = emptyDoc()
    doc.body.innerHTML = `
      <button aria-label="Show transcript">Show transcript</button>
      <ytd-engagement-panel-section-list-renderer target-id="PAmodern_transcript_view">
        <div id="visibility-button"><button aria-label="Close"></button></div>
        <transcript-segment-view-model><div class="ytwTranscriptSegmentViewModelTimestamp">0:02</div><span role="text"> first </span></transcript-segment-view-model>
        <transcript-segment-view-model><div class="ytwTranscriptSegmentViewModelTimestamp">0:07</div><span role="text">second</span></transcript-segment-view-model>
      </ytd-engagement-panel-section-list-renderer>`
    const onClose = vi.fn()
    doc.querySelector('button[aria-label="Close"]')?.addEventListener("click", onClose)
    expect(await readTranscriptFromDomPanel(doc, visible)).toEqual([
      { text: "first", startMs: 2000, endMs: 7000 },
      { text: "second", startMs: 7000, endMs: 12000 },
    ])
    expect(onClose).toHaveBeenCalledTimes(1)
  })
  it("returns [] when the Show transcript button is not visible", async () => {
    const doc = emptyDoc()
    doc.body.innerHTML = '<button aria-label="Show transcript"></button>'
    expect(await readTranscriptFromDomPanel(doc, () => false)).toEqual([])
  })
  it("clicks expand, then waits for the button to become visible", async () => {
    const doc = emptyDoc()
    doc.body.innerHTML = `
      <div id="description-inline-expander"><button id="expand"></button></div>
      <button aria-label="Show transcript" hidden></button>
      <ytd-engagement-panel-section-list-renderer target-id="engagement-panel-searchable-transcript">
        <ytd-transcript-segment-renderer><div class="segment-timestamp">0:01</div><div class="segment-text">hi</div></ytd-transcript-segment-renderer>
      </ytd-engagement-panel-section-list-renderer>`
    const btn = doc.querySelector<HTMLElement>('button[aria-label="Show transcript"]')
    doc.querySelector("#expand")?.addEventListener("click", () => {
      setTimeout(() => btn?.removeAttribute("hidden"), 250)
    })
    const segs = await readTranscriptFromDomPanel(doc, (el) => !el.hasAttribute("hidden"))
    expect(segs).toEqual([{ text: "hi", startMs: 1000, endMs: 6000 }])
  })
  it("propagates unexpected errors from inside the panel and still clicks Close", async () => {
    const doc = emptyDoc()
    doc.body.innerHTML = `
      <button aria-label="Show transcript"></button>
      <ytd-engagement-panel-section-list-renderer target-id="engagement-panel-searchable-transcript">
        <div id="visibility-button"><button aria-label="Close"></button></div>
      </ytd-engagement-panel-section-list-renderer>`
    const onClose = vi.fn()
    doc.querySelector('button[aria-label="Close"]')?.addEventListener("click", onClose)
    const panel = doc.querySelector("ytd-engagement-panel-section-list-renderer") as Element
    panel.querySelectorAll = () => {
      throw new Error("panel exploded")
    }
    await expect(readTranscriptFromDomPanel(doc, visible)).rejects.toThrow("panel exploded")
    expect(onClose).toHaveBeenCalledTimes(1)
  })
  it("clicks Close when the panel opens but never shows rows", async () => {
    vi.useFakeTimers()
    try {
      const doc = emptyDoc()
      doc.body.innerHTML = `
        <button aria-label="Show transcript"></button>
        <ytd-engagement-panel-section-list-renderer target-id="engagement-panel-searchable-transcript">
          <div id="visibility-button"><button aria-label="Close"></button></div>
        </ytd-engagement-panel-section-list-renderer>`
      const onClose = vi.fn()
      doc.querySelector('button[aria-label="Close"]')?.addEventListener("click", onClose)
      const result = readTranscriptFromDomPanel(doc, visible)
      await vi.runAllTimersAsync()
      expect(await result).toEqual([])
      expect(onClose).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
