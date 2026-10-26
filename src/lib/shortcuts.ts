export type ShortcutId = "focus-chat" | "summarize" | "search-transcript"

export interface ShortcutKeyEvent {
  code: string
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
}

const BY_CODE: Record<string, ShortcutId> = {
  KeyC: "focus-chat",
  KeyS: "summarize",
  KeyF: "search-transcript",
}

/** Matches on `code`, not `key`: on macOS Option+S types `ß`. */
export function matchShortcut(e: ShortcutKeyEvent): ShortcutId | null {
  if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return null
  return BY_CODE[e.code] ?? null
}

const EDITABLE = "input, textarea, select, [contenteditable], #search, ytd-searchbox"

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  if ((target as HTMLElement).isContentEditable) return true
  return target.closest(EDITABLE) !== null
}
