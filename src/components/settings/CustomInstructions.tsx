import { useEffect, useRef, useState } from "react"
import { Textarea } from "@/components/ui/textarea"
import { MAX_CUSTOM_INSTRUCTIONS } from "@/lib/storage"

const SAVE_DELAY_MS = 400

export interface CustomInstructionsProps {
  value: string
  onSave(value: string): void
}

/** Textarea saved on blur and after a 400 ms pause in typing (and on unmount if pending). */
export function CustomInstructions({ value, onSave }: CustomInstructionsProps) {
  const [draft, setDraft] = useState(value)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<string | null>(null)
  const save = useRef(onSave)
  save.current = onSave

  const flush = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    if (pending.current !== null) save.current(pending.current)
    pending.current = null
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: flush only reads refs
  useEffect(() => flush, [])

  const change = (next: string) => {
    const text = next.slice(0, MAX_CUSTOM_INSTRUCTIONS)
    setDraft(text)
    pending.current = text
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(flush, SAVE_DELAY_MS)
  }

  return (
    <div className="flex flex-col gap-[4px]">
      <Textarea
        aria-label="Custom instructions"
        value={draft}
        maxLength={MAX_CUSTOM_INSTRUCTIONS}
        rows={3}
        placeholder="Anything the summary should always do, e.g. focus on the code shown"
        onChange={(e) => change(e.target.value)}
        onBlur={flush}
        className="field-sizing-fixed min-h-0 resize-none rounded-[8px] border-input bg-background px-[10px] py-[8px] text-[13px] leading-[19px] text-foreground shadow-none placeholder:text-subtle-foreground md:text-[13px] dark:bg-background"
      />
      <span className="self-end font-mono text-[11px] text-subtle-foreground">
        {draft.length}/{MAX_CUSTOM_INSTRUCTIONS}
      </span>
    </div>
  )
}
