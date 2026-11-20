import type { SourceSegment } from "./types"

const TIMESTAMP =
  /^(?:(\d+):)?(\d{1,2}):(\d{2})[.](\d{1,3})(?:\s+-->\s+(?:(\d+):)?(\d{1,2}):(\d{2})[.](\d{1,3}))?/

function seconds(
  hours: string | undefined,
  minutes: string,
  secs: string,
  fraction: string,
): number {
  const frac = fraction.padEnd(3, "0").slice(0, 3)
  return (
    (hours ? Number(hours) : 0) * 3600 + Number(minutes) * 60 + Number(secs) + Number(frac) / 1000
  )
}

/** Drop WebVTT voice, class, and timestamp tags. The spoken words stay. */
export function stripCueText(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim()
}

function isHeader(line: string): boolean {
  return (
    line === "WEBVTT" ||
    line.startsWith("WEBVTT ") ||
    line.startsWith("NOTE") ||
    line.startsWith("STYLE")
  )
}

/**
 * Parse a WebVTT document into cues. Hours are optional (`mm:ss.mmm`). Cue settings after the
 * end timestamp are ignored. `NOTE` and `STYLE` blocks are skipped.
 */
export function parseVtt(input: string): SourceSegment[] {
  const lines = input
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
  const cues: SourceSegment[] = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index]?.trim() ?? ""
    if (line === "" || isHeader(line) || /^\d+$/.test(line)) {
      if (line.startsWith("NOTE") || line.startsWith("STYLE")) {
        index++
        while (index < lines.length && (lines[index]?.trim() ?? "") !== "") index++
      }
      index++
      continue
    }
    const match = TIMESTAMP.exec(line)
    if (!match?.[2] || !match[3] || !match[4] || !match[6] || !match[7] || !match[8]) {
      index++
      continue
    }
    const start = seconds(match[1], match[2], match[3], match[4])
    const end = seconds(match[5], match[6], match[7], match[8])
    index++
    const body: string[] = []
    while (index < lines.length && (lines[index]?.trim() ?? "") !== "") {
      body.push(lines[index] ?? "")
      index++
    }
    const text = stripCueText(body.join("\n"))
    if (text) cues.push({ start, end: Math.max(end, start), text })
  }
  return cues
}
