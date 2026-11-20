/** Chrome extension versions are dotted integers. A leading `v` is ignored. */
export function parseVersion(value: string): number[] | null {
  const text = value.trim().replace(/^v/i, "")
  if (!/^\d+(\.\d+){0,3}$/.test(text)) return null
  return text.split(".").map((part) => Number(part))
}

/** 1 when `left` is newer, -1 when older, 0 when equal, null when either is not a version. */
export function compareVersions(left: string, right: string): number | null {
  const a = parseVersion(left)
  const b = parseVersion(right)
  if (!a || !b) return null
  const length = Math.max(a.length, b.length)
  for (let i = 0; i < length; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0)
    if (diff !== 0) return diff > 0 ? 1 : -1
  }
  return 0
}

export function isNewerVersion(latest: string, current: string): boolean {
  return compareVersions(latest, current) === 1
}
