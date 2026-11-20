import { parseTimestamp } from "@/lib/timestamps"
import type { Concept } from "./types"

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNames(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(asString).filter(Boolean)
}

function mermaidLabel(text: string): string {
  return text.replace(/"/g, "'")
}

/** Prerequisite map: an edge means "cần biết trước" → concept. */
export function conceptMermaid(concepts: readonly Concept[]): string {
  const lines = ["flowchart TD"]
  concepts.forEach((concept, index) => {
    lines.push(`  c${index}["${mermaidLabel(concept.name)}"]`)
  })
  const byName = new Map(concepts.map((concept, index) => [concept.name.toLowerCase(), index]))
  concepts.forEach((concept, index) => {
    for (const prior of concept.prerequisites) {
      const from = byName.get(prior.toLowerCase())
      if (from === undefined || from === index) continue
      lines.push(`  c${from} --> c${index}`)
    }
  })
  return lines.join("\n")
}

function parseConcept(value: unknown): Concept | null {
  const raw = asRecord(value)
  if (!raw) return null
  const name = asString(raw.name)
  const explanation = asString(raw.explanation)
  const why = asString(raw.why)
  const stamp = asString(raw.timestamp)
  const seconds = parseTimestamp(stamp)
  if (!name || !explanation || !why || seconds === null) return null
  return {
    name,
    explanation,
    why,
    seconds,
    related: asNames(raw.related),
    prerequisites: asNames(raw.prerequisites),
  }
}

function unwrapJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text)
  const body = (fenced?.[1] ?? text).trim()
  const start = body.indexOf("{")
  const end = body.lastIndexOf("}")
  if (start === -1 || end <= start) return null
  try {
    return JSON.parse(body.slice(start, end + 1))
  } catch {
    return null
  }
}

export interface ParsedConcepts {
  concepts: Concept[]
  mermaid: string
}

/** Parse the concept JSON. A missing or empty Mermaid block is rebuilt from prerequisites. */
export function parseConcepts(text: string): ParsedConcepts | null {
  const json = asRecord(unwrapJson(text))
  if (!json || !Array.isArray(json.concepts)) return null
  const concepts = json.concepts
    .map((item) => parseConcept(item))
    .filter((item): item is Concept => item !== null)
  if (concepts.length === 0) return null
  const provided = asString(json.mermaid)
  const mermaid = /^flowchart\b|^graph\b/i.test(provided) ? provided : conceptMermaid(concepts)
  return { concepts, mermaid }
}
