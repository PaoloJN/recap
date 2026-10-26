export interface TextPart {
  text: string
  match: boolean
}

export function splitByQuery(text: string, query: string): TextPart[] {
  const q = query.trim().toLowerCase()
  if (!q) return [{ text, match: false }]
  const lower = text.toLowerCase()
  const parts: TextPart[] = []
  let from = 0
  for (let at = lower.indexOf(q); at !== -1; at = lower.indexOf(q, from)) {
    if (at > from) parts.push({ text: text.slice(from, at), match: false })
    parts.push({ text: text.slice(at, at + q.length), match: true })
    from = at + q.length
  }
  if (from < text.length) parts.push({ text: text.slice(from), match: false })
  return parts.length > 0 ? parts : [{ text, match: false }]
}
