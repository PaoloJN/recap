import { SettingsSection } from "./SettingsSection"

const SHORTCUTS = [
  ["Toggle panel", "⌥ Y"],
  ["Focus chat", "⌥ C"],
  ["Summarize video", "⌥ S"],
  ["Search transcript", "⌥ F"],
] as const

export function ShortcutsSection() {
  return (
    <SettingsSection
      id="shortcuts"
      label="Keyboard shortcuts"
      footnote="Change the toggle shortcut at chrome://extensions/shortcuts."
    >
      {SHORTCUTS.map(([label, keys]) => (
        <div key={label} className="flex items-center gap-[12px] px-[14px] py-[10px]">
          <span className="flex-1 text-[14px] leading-[20px] text-foreground">{label}</span>
          <kbd className="rounded-[4px] bg-secondary px-[6px] py-[2px] font-mono text-[11px] text-muted-foreground">
            {keys}
          </kbd>
        </div>
      ))}
    </SettingsSection>
  )
}
