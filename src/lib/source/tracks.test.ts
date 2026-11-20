import { describe, expect, it, vi } from "vitest"
import { type TrackLike, tracksFromVideo, transcriptFromTracks } from "./tracks"

const vtt = `WEBVTT

00:00:00.000 --> 00:00:01.000
From the file
`

describe("transcriptFromTracks", () => {
  it("prefers a manual track and reads its cues", async () => {
    const tracks: TrackLike[] = [
      {
        kind: "captions",
        label: "auto",
        language: "en",
        cues: [{ startTime: 0, endTime: 1, text: "auto" }],
      },
      {
        kind: "subtitles",
        label: "English",
        language: "en",
        mode: "disabled",
        cues: [{ startTime: 2, endTime: 3, text: "manual" }],
      },
    ]
    const result = await transcriptFromTracks(tracks)
    expect(result).toEqual({
      segments: [{ start: 2, end: 3, text: "manual" }],
      isAsr: false,
      language: "en",
    })
    expect(tracks[1]?.mode).toBe("hidden")
  })

  it("fetches a VTT src when the track has no cues yet", async () => {
    const fetchVtt = vi.fn(async () => vtt)
    const result = await transcriptFromTracks(
      [{ kind: "captions", label: "English", language: "vi", src: "https://cdn.example/a.vtt" }],
      fetchVtt,
    )
    expect(fetchVtt).toHaveBeenCalledWith("https://cdn.example/a.vtt")
    expect(result?.segments[0]?.text).toBe("From the file")
    expect(result?.language).toBe("vi")
  })

  it("returns null when nothing is captioned", async () => {
    expect(await transcriptFromTracks([{ kind: "metadata" }])).toBeNull()
  })
})

describe("tracksFromVideo", () => {
  it("reads a track element from a video fixture", () => {
    document.body.innerHTML = `<video>
      <track kind="subtitles" src="https://cdn.example/lecture.vtt" srclang="en" label="English">
    </video>`
    const video = document.querySelector("video")
    if (!(video instanceof HTMLVideoElement)) throw new Error("missing video")
    const tracks = tracksFromVideo(video)
    expect(tracks.some((track) => track.src === "https://cdn.example/lecture.vtt")).toBe(true)
    expect(tracks.some((track) => track.language === "en" && track.kind === "subtitles")).toBe(true)
    document.body.innerHTML = ""
  })
})
