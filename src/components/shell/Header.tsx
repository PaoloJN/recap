import {
  Check,
  ChevronsUpDown,
  FileText,
  Link,
  ListOrdered,
  type LucideIcon,
  MessageSquare,
  Settings,
  Sparkles,
} from "lucide-react"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { PanelTab } from "@/lib/types"
import { cn } from "@/lib/utils"

const TABS: { id: PanelTab; label: string; icon: LucideIcon }[] = [
  { id: "summary", label: "Summary", icon: FileText },
  { id: "transcript", label: "Transcript", icon: ListOrdered },
  { id: "chat", label: "Chat", icon: MessageSquare },
]

const COPIED_MS = 2000

export interface HeaderProps {
  tab: PanelTab
  open: boolean
  settingsActive: boolean
  onTabSelect(tab: PanelTab): void
  onToggleOpen(): void
  onOpenSettings(): void
}

function IconButton(props: { label: string; onClick(): void; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={props.label} onClick={props.onClick}>
          {props.children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{props.label}</TooltipContent>
    </Tooltip>
  )
}

export function Header({
  tab,
  open,
  settingsActive,
  onTabSelect,
  onToggleOpen,
  onOpenSettings,
}: HeaderProps) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(location.href)
    } catch (err) {
      console.error("Copy video URL failed", err)
      return
    }
    setCopied(true)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setCopied(false), COPIED_MS)
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2.5 text-card-foreground">
      <div className="flex flex-1 items-center">
        <Sparkles className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </div>
      <ButtonGroup aria-label="Panel tabs">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = open && !settingsActive && tab === id
          return (
            <Button
              key={id}
              variant="outline"
              size="sm"
              aria-pressed={active}
              className={cn(
                "text-xs",
                active && "bg-accent text-accent-foreground dark:bg-input/60",
              )}
              onClick={() => onTabSelect(id)}
            >
              <Icon className="size-3.5" />
              {label}
            </Button>
          )
        })}
      </ButtonGroup>
      <div className="flex flex-1 items-center justify-end gap-0.5">
        <IconButton label="Copy video URL" onClick={copyUrl}>
          {copied ? <Check /> : <Link />}
        </IconButton>
        <IconButton label="Settings" onClick={onOpenSettings}>
          <Settings />
        </IconButton>
        <IconButton label={open ? "Collapse" : "Expand"} onClick={onToggleOpen}>
          <ChevronsUpDown />
        </IconButton>
      </div>
    </div>
  )
}
