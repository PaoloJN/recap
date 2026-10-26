import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it, vi } from "vitest"
import type { CaptionTrack } from "@/lib/types"
import { fetchWatchPage, parseWatchPage, pickCaptionTrack } from "./watch-page"

const html = readFileSync(resolve("src/lib/youtube/__fixtures__/watch-page.html"), "utf8")

describe("parseWatchPage", () => {
  it("parses the fixture", () => {
    const data = parseWatchPage(html)
    expect(data.metadata).toEqual({
      videoId: "Tn6-PIqc4UM",
      title: "React in 100 Seconds",
      author: expect.any(String),
      durationSeconds: 128,
    })
    expect(data.metadata.author.length).toBeGreaterThan(0)
    expect(data.captionTracks).toEqual([
      { languageCode: "en", name: "English (auto-generated)", kind: "asr" },
    ])
    expect(data.innertube.client).toEqual({
      clientName: "WEB",
      clientVersion: "2.20261023.01.00",
      hl: "en",
      gl: "US",
    })
  })

  it("throws without a player response", () => {
    expect(() => parseWatchPage("<html></html>")).toThrow("player response not found")
  })

  it("throws without an innertube context", () => {
    const noCtx = html.replace(/"INNERTUBE_CONTEXT"/g, '"X"')
    expect(() => parseWatchPage(noCtx)).toThrow("innertube context not found")
  })
})

describe("pickCaptionTrack", () => {
  const t = (languageCode: string, kind?: "asr"): CaptionTrack => ({
    languageCode,
    name: languageCode,
    ...(kind ? { kind } : {}),
  })
  it("prefers manual over asr", () => {
    expect(pickCaptionTrack([t("en", "asr"), t("ja")])?.languageCode).toBe("ja")
  })
  it("prefers en", () => {
    expect(pickCaptionTrack([t("fr", "asr"), t("en", "asr")])?.languageCode).toBe("en")
  })
  it("returns null when empty", () => {
    expect(pickCaptionTrack([])).toBeNull()
  })
})

describe("fetchWatchPage", () => {
  it("GETs the watch url", async () => {
    const fetchFn = vi.fn(async () => new Response(html))
    const data = await fetchWatchPage("Tn6-PIqc4UM", fetchFn as unknown as typeof fetch)
    expect(data.metadata.videoId).toBe("Tn6-PIqc4UM")
    expect(fetchFn).toHaveBeenCalledWith("https://www.youtube.com/watch?v=Tn6-PIqc4UM", {
      credentials: "same-origin",
    })
  })
  it("throws on non-2xx", async () => {
    const fetchFn = vi.fn(async () => new Response("", { status: 500 }))
    await expect(fetchWatchPage("x", fetchFn as unknown as typeof fetch)).rejects.toThrow(
      "watch page HTTP 500",
    )
  })
})
