import {
  CheckCircle,
  CircleNotch,
  ClosedCaptioning,
  type Icon,
  Key,
  Sparkle,
  WarningCircle,
} from "@phosphor-icons/react"
import type { CollapsedIcon, collapsedStatus } from "./collapsed-status"

const ICONS: Record<CollapsedIcon, { icon: Icon; fill?: boolean; className?: string }> = {
  key: { icon: Key },
  captions: { icon: ClosedCaptioning },
  warning: { icon: WarningCircle, fill: true },
  check: { icon: CheckCircle, fill: true, className: "text-success" },
  spinner: { icon: CircleNotch, className: "animate-spin" },
  sparkle: { icon: Sparkle, fill: true },
}

export interface CollapsedRowProps {
  status: ReturnType<typeof collapsedStatus>
  onExpand(): void
}

export function CollapsedRow({ status, onExpand }: CollapsedRowProps) {
  const { icon: StatusIcon, fill, className } = ICONS[status.icon]
  return (
    <button
      type="button"
      className="mx-[12px] mb-[12px] flex cursor-pointer items-center gap-[8px] rounded-[8px] bg-secondary px-[12px] py-[8px] text-left text-[13px] text-card-foreground transition-colors duration-150 ease-out hover:bg-muted"
      onClick={onExpand}
    >
      <StatusIcon
        weight={fill ? "fill" : "regular"}
        className={`size-[16px] shrink-0 ${className ?? ""}`}
        aria-hidden
      />
      <span className="flex-1 truncate">{status.text}</span>
      <span className="font-mono text-[11px] text-subtle-foreground">⌥ Y</span>
    </button>
  )
}
