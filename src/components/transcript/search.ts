/** Indices of rows whose text contains the trimmed query (case-insensitive); empty query → []. */
export function searchMatches(rows: { text: string }[], query: string): number[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const out: number[] = []
  rows.forEach((row, i) => {
    if (row.text.toLowerCase().includes(q)) out.push(i)
  })
  return out
}

/** Wraps `i` into `[0, n)`; 0 when `n` is 0. */
export function wrapIndex(i: number, n: number): number {
  if (n <= 0) return 0
  return ((i % n) + n) % n
}
