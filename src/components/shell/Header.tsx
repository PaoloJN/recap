import { CaretDown, CaretUp, GearSix, Pause, Play } from "@phosphor-icons/react"
import type { ReactNode } from "react"
import { usePlayer } from "@/hooks/usePlayer"
import { formatMs } from "@/lib/timestamps"
import { IconButton } from "./IconButton"
import { Logo } from "./Logo"

export interface HeaderProps {
  title: string
  author: string
  /** False while there is no video page yet: the meta row shows only `author`. */
  hasVideo: boolean
  open: boolean
  onToggleOpen(): void
  onOpenSettings(): void
  moreMenu: ReactNode
}

/** Play state and time; subscribes to the player so only this subtree re-renders per tick. */
function PlayerTime() {
  const { ms, paused } = usePlayer()
  const PlayIcon = paused ? Play : Pause
  return (
    <>
      <PlayIcon weight="fill" className="size-[10px] shrink-0" aria-hidden />
      <span className="font-mono text-[11px]">{formatMs(ms)}</span>
      <span className="text-subtle-foreground">·</span>
    </>
  )
}

export function Header({
  title,
  author,
  hasVideo,
  open,
  onToggleOpen,
  onOpenSettings,
  moreMenu,
}: HeaderProps) {
  return (
    <div className="flex items-center gap-[12px] py-[12px] pr-[8px] pl-[16px]">
      <div className="flex size-[32px] shrink-0 items-center justify-center text-foreground">
        <Logo size={22} />
      </div>
      <button
        type="button"
        tabIndex={open ? -1 : 0}
        aria-label={open ? undefined : "Expand"}
        className="flex min-w-0 flex-1 cursor-default flex-col gap-[2px] text-left outline-none"
        onClick={open ? undefined : onToggleOpen}
      >
        <span className="block truncate text-[14px] leading-[20px] font-medium text-foreground">
          {title}
        </span>
        <span className="flex items-center gap-[6px] overflow-hidden text-[12px] leading-[16px] whitespace-nowrap text-muted-foreground">
          {hasVideo ? <PlayerTime /> : null}
          <span className="truncate">{author}</span>
        </span>
      </button>
      <div className="flex shrink-0 items-center">
        <IconButton label="Settings" onClick={onOpenSettings}>
          <GearSix />
        </IconButton>
        {moreMenu}
        <IconButton label={open ? "Collapse" : "Expand"} onClick={onToggleOpen}>
          {open ? <CaretUp /> : <CaretDown />}
        </IconButton>
      </div>
    </div>
  )
}
