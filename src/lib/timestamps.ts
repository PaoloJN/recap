export const TIMESTAMP_HREF_PREFIX = "#t="

// h:mm:ss or m:ss. Seconds are always two digits.
const TIME = String.raw`(?:(\d{1,2}):)?(\d{1,2}):(\d{2})`
const TIME_ONLY = new RegExp(`^${TIME}$`)
// Protected spans come first so they win: inline code, then markdown links.
// Bracketed timestamps come before bare ones so the brackets are consumed.
const SCAN = new RegExp(
  String.raw`(\`[^\`]*\`)|(\[[^\]]*\]\([^)]*\))|(?<![\w:])(?:\[${TIME}\]|${TIME})(?![\w:])`,
  "g",
)

function toSeconds(h: string | undefined, m: string, s: string): number | null {
  if (h !== undefined && m.length !== 2) return null
  const minutes = Number(m)
  const seconds = Number(s)
  if (seconds >= 60 || (h !== undefined && minutes >= 60)) return null
  return Number(h ?? 0) * 3600 + minutes * 60 + seconds
}

export function formatMs(ms: number): string {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, "0")
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`
}

export function parseTimestamp(text: string): number | null {
  const match = TIME_ONLY.exec(text)
  return match ? toSeconds(match[1], match[2] ?? "", match[3] ?? "") : null
}

export function linkifyTimestamps(markdown: string): string {
  return markdown.replace(SCAN, (match, code, link, bh, bm, bs, h, m, s) => {
    if (code || link) return match
    const seconds = bm !== undefined ? toSeconds(bh, bm, bs) : toSeconds(h, m, s)
    if (seconds === null) return match
    const label = bm !== undefined ? match.slice(1, -1) : match
    return `[${label}](${TIMESTAMP_HREF_PREFIX}${seconds})`
  })
}

export function timestampFromHref(href: string): number | null {
  if (!href.startsWith(TIMESTAMP_HREF_PREFIX)) return null
  const value = href.slice(TIMESTAMP_HREF_PREFIX.length)
  return /^\d+$/.test(value) ? Number(value) : null
}
