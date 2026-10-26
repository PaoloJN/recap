import { CaretUp, Check } from "@phosphor-icons/react"
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useSettings } from "@/hooks/useSettings"
import { PROVIDERS } from "@/lib/providers"
import { DEFAULT_SETTINGS } from "@/lib/storage"

/** Composer model switch: the provider's models in an upward menu; writes `settings.models`. */
export function ModelPicker() {
  const [stored, update] = useSettings()
  const settings = stored ?? DEFAULT_SETTINGS
  const provider = settings.provider
  const model = settings.models[provider]
  const models = PROVIDERS[provider].models
  const label = models.find((m) => m.id === model)?.label ?? model

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
        <DropdownMenuRadioGroup
          value={model}
          onValueChange={(id) => void update({ models: { ...settings.models, [provider]: id } })}
        >
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
