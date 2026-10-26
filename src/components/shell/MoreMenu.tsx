import {
  ChatTeardropText,
  DotsThreeVertical,
  DownloadSimple,
  type Icon,
  Keyboard,
  LinkSimple,
} from "@phosphor-icons/react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { usePlayer } from "@/hooks/usePlayer"
import { formatMs } from "@/lib/timestamps"
import { IconButton } from "./IconButton"
import { useToast } from "./ToastContext"

const FEEDBACK_URL = "https://github.com/PaoloJN/recap/issues/new"

export interface MoreMenuProps {
  /** Null until the watch page has loaded; video items are disabled meanwhile. */
  videoId: string | null
  onExport(): void
  onShortcuts(): void
}

function Item(props: { icon: Icon; label: string; disabled?: boolean; onSelect(): void }) {
  const { icon: ItemIcon } = props
  return (
    <DropdownMenuItem
      disabled={props.disabled}
      onSelect={props.onSelect}
      className="gap-[14px] rounded-none px-[16px] py-[8px] text-[14px] text-popover-foreground focus:bg-secondary focus:text-popover-foreground"
    >
      <ItemIcon className="size-[18px] text-muted-foreground" aria-hidden />
      <span className="flex-1">{props.label}</span>
    </DropdownMenuItem>
  )
}

/** Mounted only while the menu is open, so the player subscription lives only that long. */
function MoreMenuItems({ videoId, onExport, onShortcuts }: MoreMenuProps) {
  const toast = useToast()
  const { ms } = usePlayer()
  const noVideo = videoId === null

  const copyLink = () => {
    if (!videoId) return
    const url = `https://youtu.be/${videoId}?t=${Math.floor(ms / 1000)}`
    navigator.clipboard.writeText(url).then(
      () => toast("Link copied"),
      () => toast("Couldn't copy the link"),
    )
  }

  return (
    <>
      <Item
        icon={LinkSimple}
        label={`Copy link at ${formatMs(ms)}`}
        disabled={noVideo}
        onSelect={copyLink}
      />
      <Item
        icon={DownloadSimple}
        label="Export as Markdown"
        disabled={noVideo}
        onSelect={onExport}
      />
      <Item icon={Keyboard} label="Keyboard shortcuts" onSelect={onShortcuts} />
      <Item
        icon={ChatTeardropText}
        label="Send feedback"
        onSelect={() => window.open(FEEDBACK_URL, "_blank", "noopener")}
      />
    </>
  )
}

export function MoreMenu(props: MoreMenuProps) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <IconButton label="More">
          <DotsThreeVertical />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[244px] rounded-[12px] border bg-popover px-0 py-[8px] shadow-pop"
      >
        <MoreMenuItems {...props} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
