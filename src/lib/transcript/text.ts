import { formatMs } from "../timestamps"
import type { Chapter } from "../types"

const FILLERS = /,?\s*\b(um|uh|you know)\b,?/gi

export function stripFillers(text: string): string {
  return text
    .replace(FILLERS, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,])/g, "$1")
    .trim()
}

export function displayText(text: string, removeFillers: boolean): string {
  return removeFillers ? stripFillers(text) : text
}

export type TranscriptListItem<T> =
  | { kind: "chapter"; chapter: Chapter }
  | { kind: "line"; row: T; index: number }

export function withChapterHeaders<T extends { startMs: number }>(
  rows: T[],
  chapters: Chapter[],
): TranscriptListItem<T>[] {
  const headersBefore = new Map<number, Chapter[]>()
  let from = 0
  for (const chapter of chapters) {
    const at = rows.findIndex((r, i) => i >= from && r.startMs >= chapter.seconds * 1000)
    if (at === -1) continue
    const list = headersBefore.get(at) ?? []
    list.push(chapter)
    headersBefore.set(at, list)
    from = at + 1
  }
  const items: TranscriptListItem<T>[] = []
  rows.forEach((row, index) => {
    for (const chapter of headersBefore.get(index) ?? []) items.push({ kind: "chapter", chapter })
    items.push({ kind: "line", row, index })
  })
  return items
}

export function transcriptToText(rows: { startMs: number; text: string }[]): string {
  return rows.map((r) => `${formatMs(r.startMs)} ${r.text}`).join("\n")
}
