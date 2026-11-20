import { CaretUp, Check } from "@phosphor-icons/react"
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui"
import { useEffect } from "react"
import { useChatGptSignedIn } from "@/components/settings/ChatGptAccount"
import { useChatGptModels } from "@/components/settings/useChatGptModels"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useSettings } from "@/hooks/useSettings"
import type { ChatGptModel } from "@/lib/chatgpt/models"
import { PROVIDERS } from "@/lib/providers"
import { DEFAULT_SETTINGS } from "@/lib/storage"

function withCurrent(models: ChatGptModel[], current: string) {
  const options = models.map((item) => ({ id: item.id, label: item.label, note: "ChatGPT" }))
  if (current && !options.some((item) => item.id === current)) {
    options.unshift({ id: current, label: current, note: "ChatGPT" })
  }
  return options
}

function ChatGptModelInput({ model, onChange }: { model: string; onChange(id: string): void }) {
  return (
    <input
      aria-label="Model id"
      value={model}
      placeholder="model id"
      onChange={(event) => onChange(event.target.value.trim())}
      className="h-[28px] w-[140px] rounded-[6px] bg-secondary px-[8px] text-[12px] text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    />
  )
}

/** Composer model switch: the provider's models in an upward menu; writes `settings.models`. */
export function ModelPicker() {
  const [stored, update] = useSettings()
  const settings = stored ?? DEFAULT_SETTINGS
  const provider = settings.provider
  const model = settings.models[provider]
  const signedIn = useChatGptSignedIn()
  const remote = useChatGptModels(provider === "chatgpt" && signedIn)
  const setModel = (id: string) => void update({ models: { ...settings.models, [provider]: id } })
  useEffect(() => {
    const first = remote.models[0]
    if (provider !== "chatgpt" || !remote.loaded || model !== "" || !first) return
    void update({ models: { ...settings.models, chatgpt: first.id } })
  }, [provider, remote.loaded, remote.models, model, settings.models, update])
  if (provider === "chatgpt") {
    if (!remote.loaded) {
      return <span className="px-[8px] text-[12px] text-muted-foreground">{model || "…"}</span>
    }
    if (remote.models.length === 0) return <ChatGptModelInput model={model} onChange={setModel} />
  }
  const models =
    provider === "chatgpt" ? withCurrent(remote.models, model) : PROVIDERS[provider].models
  const selected = models.some((item) => item.id === model) ? model : (models[0]?.id ?? model)
  const label = models.find((item) => item.id === selected)?.label ?? selected

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Model: ${label}`}
          className="flex h-[28px] min-w-0 cursor-pointer items-center gap-[4px] rounded-[6px] px-[8px] text-[12px] font-medium text-muted-foreground transition-colors duration-150 outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=open]:bg-secondary data-[state=open]:text-foreground"
        >
          <span className="truncate">{label}</span>
          <CaretUp className="size-[12px] shrink-0" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="start"
        sideOffset={6}
        className="w-[236px] rounded-[12px] border bg-popover px-0 py-[8px] shadow-pop"
      >
        <DropdownMenuRadioGroup value={selected} onValueChange={setModel}>
          {models.map((m) => (
            <DropdownMenuPrimitive.RadioItem
              key={m.id}
              value={m.id}
              className="group flex w-full cursor-pointer items-center gap-[12px] px-[16px] py-[8px] text-left text-popover-foreground outline-none select-none focus:bg-secondary"
            >
              <Check
                className="invisible size-[16px] shrink-0 group-data-[state=checked]:visible"
                aria-hidden
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[14px] leading-[20px]">{m.label}</span>
                <span className="text-[12px] leading-[16px] text-muted-foreground">{m.note}</span>
              </span>
            </DropdownMenuPrimitive.RadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
