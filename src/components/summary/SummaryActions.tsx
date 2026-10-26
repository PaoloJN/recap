import { ArrowClockwise, Check, PencilSimple, SlidersHorizontal, Stop } from "@phosphor-icons/react"
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui"
import { useEffect } from "react"
import { IconButton } from "@/components/shell/IconButton"
import { usePanelNav } from "@/components/shell/NavigationContext"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useSettings } from "@/hooks/useSettings"
import { PROVIDERS } from "@/lib/providers"
import { DEFAULT_SETTINGS } from "@/lib/storage"
import { SUMMARY_STYLE_IDS, SUMMARY_STYLES } from "@/lib/summary/styles"
import type { SummaryStyle } from "@/lib/types"
import { useSummaryContext } from "./SummaryContext"

const ITEM =
  "flex w-full cursor-pointer items-center gap-[12px] px-[16px] py-[8px] text-left text-popover-foreground outline-none select-none focus:bg-secondary data-[disabled]:pointer-events-none data-[disabled]:opacity-50"

function GroupLabel({ children }: { children: string }) {
  return (
    <div className="px-[16px] pt-[4px] pb-[6px] text-[12px] leading-[16px] text-subtle-foreground">
      {children}
    </div>
  )
}

function Option({ value, name, note }: { value: string; name: string; note: string }) {
  return (
    <DropdownMenuPrimitive.RadioItem value={value} className={`group ${ITEM}`}>
      <Check
        className="invisible size-[16px] shrink-0 group-data-[state=checked]:visible"
        aria-hidden
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[14px] leading-[20px]">{name}</span>
        {note ? (
          <span className="text-[12px] leading-[16px] text-muted-foreground">{note}</span>
        ) : null}
      </span>
    </DropdownMenuPrimitive.RadioItem>
  )
}

function Separator() {
  return <DropdownMenuPrimitive.Separator className="my-[8px] h-px bg-border" />
}

/** Tab-row actions for the Summary tab: Regenerate (Stop while streaming) and Options. */
export function SummaryActions() {
  const { optionsOpen, setOptionsOpen, setView } = usePanelNav()
  const { status, style, setStyle, generate, stop } = useSummaryContext()
  const [storedSettings, update] = useSettings()
  const settings = storedSettings ?? DEFAULT_SETTINGS
  const provider = settings.provider
  const model = settings.models[provider]

  // Don't leave the menu flagged open for the next time the Summary tab shows.
  useEffect(() => () => setOptionsOpen(false), [setOptionsOpen])

  return (
    <div className="flex items-center">
      {status === "streaming" ? (
        <IconButton label="Stop" className="[&_svg]:size-[17px]" onClick={stop}>
          <Stop weight="fill" />
        </IconButton>
      ) : (
        <IconButton
          label="Regenerate"
          className="[&_svg]:size-[17px]"
          onClick={() => generate({ force: true })}
        >
          <ArrowClockwise />
        </IconButton>
      )}
      <DropdownMenu modal={false} open={optionsOpen} onOpenChange={setOptionsOpen}>
        <DropdownMenuTrigger asChild>
          <IconButton label="Summary options" className="[&_svg]:size-[17px]">
            <SlidersHorizontal />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-[252px] rounded-[12px] border bg-popover px-0 py-[8px] shadow-pop"
        >
          <GroupLabel>Style</GroupLabel>
          <DropdownMenuRadioGroup
            value={style}
            onValueChange={(id) => setStyle(id as SummaryStyle)}
          >
            {SUMMARY_STYLE_IDS.map((id) => (
              <Option
                key={id}
                value={id}
                name={SUMMARY_STYLES[id].label}
                note={SUMMARY_STYLES[id].note}
              />
            ))}
          </DropdownMenuRadioGroup>
          <Separator />
          <GroupLabel>Model</GroupLabel>
          <DropdownMenuRadioGroup
            value={model}
            onValueChange={(id) => void update({ models: { ...settings.models, [provider]: id } })}
          >
            {PROVIDERS[provider].models.map((m) => (
              <Option key={m.id} value={m.id} name={m.label} note={m.note} />
            ))}
          </DropdownMenuRadioGroup>
          <Separator />
          <DropdownMenuItem
            className={`${ITEM} rounded-none text-[14px] leading-[20px] focus:text-popover-foreground`}
            onSelect={() => setView("settings")}
          >
            <PencilSimple className="size-[16px] text-muted-foreground" aria-hidden />
            Custom instructions…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
