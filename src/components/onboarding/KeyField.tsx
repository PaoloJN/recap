import { Eye, EyeSlash } from "@phosphor-icons/react"
import { useRef } from "react"
import { secondaryButton } from "@/components/summary/buttons"
import { PROVIDERS } from "@/lib/providers"
import type { ProviderId } from "@/lib/types"
import { cn } from "@/lib/utils"

export type KeyFieldState = "idle" | "error" | "invalid" | "valid" | "checking"

export interface KeyFieldProps {
  provider: ProviderId
  value: string
  onChange(value: string): void
  show: boolean
  onToggleShow(): void
  onPaste(text: string): void
  onSubmit?(): void
  state: KeyFieldState
}

const BORDER: Record<KeyFieldState, string> = {
  idle: "border-input",
  checking: "border-input",
  error: "border-destructive",
  invalid: "border-destructive",
  valid: "border-success",
}

export function KeyField({
  provider,
  value,
  onChange,
  show,
  onToggleShow,
  onPaste,
  onSubmit,
  state,
}: KeyFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const paste = async () => {
    try {
      onPaste(await navigator.clipboard.readText())
    } catch {
      inputRef.current?.focus()
    }
  }
  return (
    <div
      className={cn(
        "flex h-[40px] items-center gap-[4px] rounded-[8px] border bg-background pr-[6px] pl-[12px] focus-within:border-ring",
        BORDER[state],
      )}
    >
      <input
        ref={inputRef}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit?.()
        }}
        autoComplete="off"
        spellCheck={false}
        aria-label={`${PROVIDERS[provider].label} API key`}
        aria-invalid={state === "error" || state === "invalid"}
        placeholder={`Paste your key (${PROVIDERS[provider].keyHint})`}
        className="min-w-0 flex-1 bg-transparent font-mono text-[13px] text-foreground outline-none placeholder:text-subtle-foreground"
      />
      <button
        type="button"
        aria-label={show ? "Hide key" : "Show key"}
        onClick={onToggleShow}
        className="flex size-[28px] shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {show ? <EyeSlash size={16} /> : <Eye size={16} />}
      </button>
      <button
        type="button"
        onClick={paste}
        className={cn(secondaryButton, "h-[28px] px-[10px] text-[12px]")}
      >
        Paste
      </button>
    </div>
  )
}
