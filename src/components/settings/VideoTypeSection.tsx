import { useEffect, useState } from "react"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useSettings } from "@/hooks/useSettings"
import {
  MAX_VIDEO_TYPE_PROMPT,
  VIDEO_TYPE_LABELS,
  VIDEO_TYPE_PRESETS,
  VIDEO_TYPES,
  type VideoType,
} from "@/lib/prompts/video-type"
import { SettingsRow } from "./SettingsRow"
import { SettingsSection } from "./SettingsSection"
import { PROMPT_FIELD, SMALL_BUTTON } from "./styles"

function TypePrompt({
  type,
  saved,
  onSave,
}: {
  type: VideoType
  saved: string | undefined
  onSave(text: string): void
}) {
  const preset = VIDEO_TYPE_PRESETS[type]
  const [draft, setDraft] = useState(saved?.trim() ? saved : preset)
  useEffect(() => {
    setDraft(saved?.trim() ? saved : preset)
  }, [saved, preset])
  const dirty = draft.trim() !== preset
  return (
    <div className="flex flex-col gap-[6px] px-[14px] py-[10px]">
      <div className="flex items-center justify-between gap-[8px]">
        <span className="text-[13px] text-foreground">{VIDEO_TYPE_LABELS[type]}</span>
        <button
          type="button"
          className={SMALL_BUTTON}
          disabled={!dirty && !saved?.trim()}
          onClick={() => {
            setDraft(preset)
            onSave("")
          }}
        >
          Khôi phục mặc định
        </button>
      </div>
      <Textarea
        aria-label={`Prompt ${VIDEO_TYPE_LABELS[type]}`}
        value={draft}
        maxLength={MAX_VIDEO_TYPE_PROMPT}
        rows={6}
        onChange={(event) => setDraft(event.target.value.slice(0, MAX_VIDEO_TYPE_PROMPT))}
        onBlur={() => onSave(draft.trim() === preset ? "" : draft.trim())}
        className={PROMPT_FIELD}
      />
      <span className="self-end font-mono text-[11px] text-subtle-foreground">
        {draft.length}/{MAX_VIDEO_TYPE_PROMPT}
      </span>
    </div>
  )
}

export function VideoTypeSection() {
  const [settings, set] = useSettings()
  if (!settings) return null
  const save = (type: VideoType, text: string) => {
    const videoTypePrompts = { ...settings.videoTypePrompts }
    if (text.trim()) videoTypePrompts[type] = text.trim()
    else delete videoTypePrompts[type]
    set({ videoTypePrompts })
  }
  return (
    <SettingsSection label="Prompt theo loại video">
      <SettingsRow
        title="Tự nhận diện"
        note="Đoán loại từ trang và tiêu đề. Chỉ gọi model khi chưa chắc."
        control={
          <Switch
            aria-label="Tự nhận diện loại video"
            checked={settings.autoDetectVideoType}
            onCheckedChange={(autoDetectVideoType) => set({ autoDetectVideoType })}
          />
        }
      />
      {VIDEO_TYPES.map((type) => (
        <TypePrompt
          key={type}
          type={type}
          saved={settings.videoTypePrompts[type]}
          onSave={(text) => save(type, text)}
        />
      ))}
    </SettingsSection>
  )
}
