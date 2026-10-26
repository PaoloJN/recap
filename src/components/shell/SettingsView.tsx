import { browser } from "wxt/browser"
import { CustomInstructions } from "@/components/settings/CustomInstructions"
import { DataSection } from "@/components/settings/DataSection"
import { Segmented } from "@/components/settings/Segmented"
import { SettingsRow } from "@/components/settings/SettingsRow"
import { SettingsSection } from "@/components/settings/SettingsSection"
import { ShortcutsSection } from "@/components/settings/ShortcutsSection"
import { SMALL_BUTTON } from "@/components/settings/styles"
import { UsageSection } from "@/components/settings/UsageSection"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useSettings } from "@/hooks/useSettings"
import { useStorageItem } from "@/hooks/useStorageItem"
import { PROVIDER_IDS, PROVIDERS } from "@/lib/providers"
import { apiKeysItem, type Settings } from "@/lib/storage"
import { SUMMARY_STYLE_IDS, SUMMARY_STYLES } from "@/lib/summary/styles"
import {
  ANSWER_LANGUAGES,
  type AnswerLanguage,
  type ProviderId,
  type SummaryStyle,
  type TextSize,
  type ThemeSetting,
} from "@/lib/types"
import { cn } from "@/lib/utils"
import { usePanelNav } from "./NavigationContext"
import { useToast } from "./ToastContext"

const REPO = "https://github.com/PaoloJN/recap"
const FOOTER_LINKS = [
  ["What's new", `${REPO}/blob/main/CHANGELOG.md`],
  ["Send feedback", `${REPO}/issues/new`],
  ["Privacy", `${REPO}#privacy`],
] as const

const THEME_OPTIONS = [
  ["youtube", "Match YouTube"],
  ["dark", "Dark"],
  ["light", "Light"],
] as const satisfies readonly (readonly [ThemeSetting, string])[]

const SIZE_OPTIONS = [
  ["s", "S"],
  ["m", "M"],
  ["l", "L"],
] as const satisfies readonly (readonly [TextSize, string])[]

/** `sk-…4f2a`: first 3 chars and last 4; short keys are fully hidden. */
export function maskKey(key: string): string {
  return key.length < 8 ? "••••" : `${key.slice(0, 3)}…${key.slice(-4)}`
}

function extensionVersion(): string {
  try {
    return browser.runtime.getManifest().version
  } catch {
    return "2.0.0"
  }
}

/** Mono version label for the Settings sub-header. */
export function SettingsVersion() {
  return (
    <span className="shrink-0 font-mono text-[11px] text-subtle-foreground">
      v{extensionVersion()}
    </span>
  )
}

interface PickerProps<T extends string> {
  label: string
  value: T
  options: readonly { id: T; label: string }[]
  onChange(value: T): void
}

function Picker<T extends string>({ label, value, options, onChange }: PickerProps<T>) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger aria-label={label} className="max-w-[180px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" align="end">
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function ApiKeyRow({ provider }: { provider: ProviderId }) {
  const { setView } = usePanelNav()
  const toast = useToast()
  const [apiKeys] = useStorageItem(apiKeysItem)
  const key = apiKeys?.[provider]
  const label = PROVIDERS[provider].label

  const remove = async () => {
    const { [provider]: _removed, ...rest } = await apiKeysItem.getValue()
    await apiKeysItem.setValue(rest)
    toast(`Removed ${label} key`)
  }

  const status = key ? (
    <span className="flex items-center gap-[6px]">
      <span className="size-[6px] shrink-0 rounded-full bg-success" aria-hidden />
      <span>Connected</span>
      <span className="truncate font-mono">{maskKey(key)}</span>
    </span>
  ) : (
    "Not connected"
  )

  const ghost = cn(SMALL_BUTTON, "px-[10px] hover:bg-secondary")
  return (
    <SettingsRow
      title="API key"
      note={status}
      control={
        key ? (
          <div className="flex items-center gap-[4px]">
            <button
              type="button"
              onClick={() => setView("onboarding")}
              className={cn(ghost, "text-foreground")}
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => void remove()}
              className={cn(ghost, "text-destructive")}
            >
              Remove
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setView("onboarding")}
            className={cn(SMALL_BUTTON, "bg-secondary text-foreground hover:bg-muted")}
          >
            Add key
          </button>
        )
      }
    />
  )
}

const PROVIDER_OPTIONS = PROVIDER_IDS.map((id) => ({ id, label: PROVIDERS[id].label }))
const STYLE_OPTIONS = SUMMARY_STYLE_IDS.map((id) => ({ id, label: SUMMARY_STYLES[id].label }))
const LANGUAGE_OPTIONS = ANSWER_LANGUAGES.map((id) => ({
  id,
  label: id === "match" ? "Match video" : id,
}))

function SettingsBody({
  settings,
  update,
}: {
  settings: Settings
  update(patch: Partial<Settings>): Promise<void>
}) {
  const { provider } = settings
  const set = (patch: Partial<Settings>) => void update(patch)

  return (
    <div className="flex flex-col gap-[20px] p-[16px] pb-[24px]">
      <SettingsSection label="Model">
        <SettingsRow
          title="Provider"
          control={
            <Picker<ProviderId>
              label="Provider"
              value={provider}
              options={PROVIDER_OPTIONS}
              onChange={(next) => set({ provider: next })}
            />
          }
        />
        <ApiKeyRow provider={provider} />
        <SettingsRow
          title="Default model"
          control={
            <Picker
              label="Default model"
              value={settings.models[provider]}
              options={PROVIDERS[provider].models}
              onChange={(id) => set({ models: { ...settings.models, [provider]: id } })}
            />
          }
        />
      </SettingsSection>

      <UsageSection />

      <SettingsSection label="Summaries">
        <SettingsRow
          title="Default style"
          control={
            <Picker<SummaryStyle>
              label="Default style"
              value={settings.defaultStyle}
              options={STYLE_OPTIONS}
              onChange={(defaultStyle) => set({ defaultStyle })}
            />
          }
        />
        <SettingsRow
          title="Answer language"
          note="Summaries and chat replies"
          control={
            <Picker<AnswerLanguage>
              label="Answer language"
              value={settings.language}
              options={LANGUAGE_OPTIONS}
              onChange={(language) => set({ language })}
            />
          }
        />
        <SettingsRow
          title="Auto-summarize"
          note="Start as soon as a video opens"
          control={
            <Switch
              aria-label="Auto-summarize"
              checked={settings.autoSummarize}
              onCheckedChange={(autoSummarize) => set({ autoSummarize })}
            />
          }
        />
        <SettingsRow
          stacked
          title="Custom instructions"
          control={
            <CustomInstructions
              value={settings.customInstructions}
              onSave={(customInstructions) => set({ customInstructions })}
            />
          }
        />
      </SettingsSection>

      <SettingsSection label="Transcript">
        <SettingsRow
          title="Follow playback"
          note="Keep the current line in view"
          control={
            <Switch
              aria-label="Follow playback"
              checked={settings.followPlayback}
              onCheckedChange={(followPlayback) => set({ followPlayback })}
            />
          }
        />
        <SettingsRow
          title="Remove filler words"
          note="Strips “um”, “uh”, “you know”"
          control={
            <Switch
              aria-label="Remove filler words"
              checked={settings.removeFillers}
              onCheckedChange={(removeFillers) => set({ removeFillers })}
            />
          }
        />
      </SettingsSection>

      <SettingsSection label="Appearance">
        <SettingsRow
          title="Theme"
          control={
            <Segmented
              label="Theme"
              value={settings.theme}
              options={THEME_OPTIONS}
              onChange={(theme) => set({ theme })}
              itemClassName="px-[10px]"
            />
          }
        />
        <SettingsRow
          title="Text size"
          control={
            <Segmented
              label="Text size"
              value={settings.textSize}
              options={SIZE_OPTIONS}
              onChange={(textSize) => set({ textSize })}
              itemClassName="min-w-[32px]"
            />
          }
        />
      </SettingsSection>

      <ShortcutsSection />

      <DataSection />

      <nav className="flex items-center justify-center gap-[12px] text-[12px] text-muted-foreground">
        {FOOTER_LINKS.map(([text, href], i) => (
          <span key={text} className="contents">
            {i > 0 ? <span aria-hidden>·</span> : null}
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground hover:underline"
            >
              {text}
            </a>
          </span>
        ))}
      </nav>
    </div>
  )
}

/** Scrollable settings body; the sub-header (← back, "Settings", version) is in Panel. */
export function SettingsView() {
  const [settings, update] = useSettings()
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      {settings ? <SettingsBody settings={settings} update={update} /> : null}
    </div>
  )
}
