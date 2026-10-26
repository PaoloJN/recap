import { ArrowLeft, ExternalLink } from "lucide-react"
import { useId, useRef } from "react"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PROVIDER_IDS, PROVIDERS } from "@/lib/providers"
import { type ApiKeys, apiKeysItem, type Settings, settingsItem } from "@/lib/storage"
import type { ProviderId } from "@/lib/types"
import { cn } from "@/lib/utils"

export interface SettingsViewProps {
  settings: Settings
  apiKeys: ApiKeys
  onBack(): void
}

export function SettingsView({ settings, apiKeys, onBack }: SettingsViewProps) {
  const provider = settings.provider
  const info = PROVIDERS[provider]
  const hasKey = Boolean(apiKeys[provider])
  const keyRef = useRef<HTMLInputElement>(null)
  const modelId = useId()
  const keyId = useId()

  const setProvider = (next: ProviderId) => {
    void settingsItem.setValue({ ...settings, provider: next })
  }

  const setModel = (model: string) => {
    void settingsItem.setValue({ ...settings, models: { ...settings.models, [provider]: model } })
  }

  const saveKey = async () => {
    const key = keyRef.current?.value.trim()
    if (!key) return
    const current = await apiKeysItem.getValue()
    await apiKeysItem.setValue({ ...current, [provider]: key })
    if (keyRef.current) keyRef.current.value = ""
  }

  const removeKey = async () => {
    const { [provider]: _removed, ...rest } = await apiKeysItem.getValue()
    await apiKeysItem.setValue(rest)
  }

  return (
    <div className="flex flex-col gap-4 p-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" aria-label="Back" onClick={onBack}>
          <ArrowLeft />
        </Button>
        <span className="text-sm font-medium">Settings</span>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">Provider</span>
        <ButtonGroup aria-label="Provider">
          {PROVIDER_IDS.map((id) => (
            <Button
              key={id}
              variant="outline"
              size="sm"
              aria-pressed={id === provider}
              className={cn(id === provider && "bg-accent text-accent-foreground dark:bg-input/60")}
              onClick={() => setProvider(id)}
            >
              {PROVIDERS[id].label}
            </Button>
          ))}
        </ButtonGroup>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={modelId} className="text-xs text-muted-foreground">
          Model
        </Label>
        <Select value={settings.models[provider]} onValueChange={setModel}>
          <SelectTrigger id={modelId} size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            {info.models.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor={keyId} className="text-xs text-muted-foreground">
            API key
          </Label>
          <a
            href={info.keyUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
          >
            Get a key
            <ExternalLink className="size-3" />
          </a>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void saveKey()
          }}
        >
          <Input
            key={provider}
            ref={keyRef}
            id={keyId}
            type="password"
            autoComplete="off"
            placeholder={`Paste your ${info.label} API key`}
            className="h-8"
          />
          <Button type="submit" size="sm">
            Save
          </Button>
          {hasKey ? (
            <Button type="button" variant="outline" size="sm" onClick={() => void removeKey()}>
              Remove
            </Button>
          ) : null}
        </form>
        <p className="text-xs text-muted-foreground">
          {hasKey ? "Key saved" : "No key saved"} · stored locally, sent only to {info.label}.
        </p>
      </div>
    </div>
  )
}
