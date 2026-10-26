import { useCallback, useMemo, useState } from "react"
import { searchMatches, wrapIndex } from "./search"

export interface TranscriptSearch {
  /** Row indices containing the query. */
  matches: number[]
  /** `matches[index]`, or -1 when there are none. */
  current: number
  index: number
  next(): void
  prev(): void
  reset(): void
}

/** Match stepping over `rows`; the index resets to 0 whenever `query` or `rows` change. */
export function useTranscriptSearch(rows: { text: string }[], query: string): TranscriptSearch {
  const matches = useMemo(() => searchMatches(rows, query), [rows, query])
  const [state, setState] = useState({ index: 0, rows, query })
  let raw = state.index
  if (state.rows !== rows || state.query !== query) {
    raw = 0
    setState({ index: 0, rows, query })
  }
  const count = matches.length
  const index = wrapIndex(raw, count)
  const current = count > 0 ? (matches[index] ?? -1) : -1

  const step = useCallback(
    (by: number) => setState((s) => ({ ...s, index: wrapIndex(s.index + by, count) })),
    [count],
  )
  const next = useCallback(() => step(1), [step])
  const prev = useCallback(() => step(-1), [step])
  const reset = useCallback(() => setState((s) => ({ ...s, index: 0 })), [])

  return { matches, current, index, next, prev, reset }
}
