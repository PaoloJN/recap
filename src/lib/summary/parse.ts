import { parseTimestamp } from "@/lib/timestamps"

export interface ParsedSummary {
  lead: string
  moments: { seconds: number; text: string }[]
  notes: string[]
  plain: string
  questions: string[]
}

type Section = "lead" | "moments" | "notes" | "plain" | "questions"

const HEADING_NAMES = ["key moments", "notes", "in plain terms", "questions"] as const
const HEADING = /^#{1,6}\s*(key moments|notes|in plain terms|questions)\s*$/i
const ANY_HEADING = /^#{1,6}\s*([a-z ]*)$/i
const MOMENT = /^[-*•]\s*\**\[?((?:\d{1,2}:)?\d{1,2}:\d{2})\]?\**[\s:–—-]*(.*)$/
const OTHER_HEADING = /^#{1,6}\s*\S/
const BULLET = /^[-*•]\s*/

const SECTION_BY_NAME: Record<(typeof HEADING_NAMES)[number], Section> = {
  "key moments": "moments",
  notes: "notes",
  "in plain terms": "plain",
  questions: "questions",
}

function headingSection(line: string): Section | null {
  const m = HEADING.exec(line.trim())
  const name = m?.[1]?.toLowerCase() as (typeof HEADING_NAMES)[number] | undefined
  return name ? SECTION_BY_NAME[name] : null
}

/** A final line like `## Not` that may still become a known heading. */
function isPartialHeading(line: string): boolean {
  const m = ANY_HEADING.exec(line.trim())
  if (!m) return false
  const typed = (m[1] ?? "").trim().toLowerCase()
  return HEADING_NAMES.some((h) => h.startsWith(typed))
}

function paragraphs(lines: string[]): string {
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export function parseSummary(text: string, opts?: { streaming?: boolean }): ParsedSummary {
  const out: ParsedSummary = { lead: "", moments: [], notes: [], plain: "", questions: [] }
  try {
    const lines = text.split("\n")
    // Drop an unfinished heading at the very end (streaming).
    const last = lines.at(-1)
    let popped = false
    if (last !== undefined && headingSection(last) === null && isPartialHeading(last)) {
      lines.pop()
      popped = true
    }
    // The final line of unterminated input may still be streaming in.
    const openIndex =
      opts?.streaming === true && !popped && !text.endsWith("\n") ? lines.length - 1 : -1
    const lead: string[] = []
    const plain: string[] = []
    let section: Section = "lead"
    for (const [i, raw] of lines.entries()) {
      const line = raw.trimEnd()
      const next = headingSection(line)
      if (next) {
        section = next
        continue
      }
      const t = line.trim()
      if (OTHER_HEADING.test(t)) {
        // Unknown headings belong to the lead.
        section = "lead"
        lead.push(line)
        continue
      }
      if (section === "lead") lead.push(line)
      else if (section === "plain") plain.push(line)
      else if (t === "") continue
      else if (section === "moments") {
        if (i === openIndex) continue
        const m = MOMENT.exec(t)
        const seconds = m?.[1] ? parseTimestamp(m[1]) : null
        if (m && seconds !== null) out.moments.push({ seconds, text: (m[2] ?? "").trim() })
      } else if (BULLET.test(t)) {
        const item = t.replace(BULLET, "").trim()
        if (item) out[section].push(item)
      }
    }
    out.lead = paragraphs(lead)
    out.plain = paragraphs(plain)
  } catch {
    // Parsing never throws; return whatever was gathered.
  }
  return out
}

/** The summary as Markdown without the Questions section, for copying. */
export function summaryForCopy(text: string): string {
  const kept: string[] = []
  let skipping = false
  for (const line of text.split("\n")) {
    const section = headingSection(line)
    if (section) skipping = section === "questions"
    if (!skipping) kept.push(line)
  }
  return kept.join("\n").trim()
}

export function estimateLabel(transcriptChars: number): "5s" | "10s" | "20s" {
  if (transcriptChars < 20_000) return "5s"
  if (transcriptChars < 60_000) return "10s"
  return "20s"
}
