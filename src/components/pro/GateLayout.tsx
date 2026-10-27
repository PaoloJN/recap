import type { Icon } from "@phosphor-icons/react"
import type { ReactNode } from "react"

export interface GateRow {
  icon: Icon
  title: string
}

/** The NoKeyGate layout shared by the Recap Pro gates: icon tile, heading, body, rows, actions. */
export function GateLayout({
  icon: TileIcon,
  title,
  body,
  rows,
  children,
}: {
  icon: Icon
  title: string
  body?: ReactNode
  rows?: GateRow[]
  /** The action buttons, stacked full width. */
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-[20px] p-[20px] py-[28px]">
      <div className="flex flex-col gap-[12px]">
        <div className="flex size-[44px] items-center justify-center rounded-[12px] bg-secondary text-foreground">
          <TileIcon size={22} aria-hidden />
        </div>
        <h2 className="text-[16px] leading-[22px] font-medium text-foreground">{title}</h2>
        {body ? <p className="text-[14px] leading-[21px] text-muted-foreground">{body}</p> : null}
      </div>
      {rows && rows.length > 0 ? (
        <div className="divide-y divide-border overflow-hidden rounded-[12px] bg-card">
          {rows.map(({ icon: RowIcon, title: rowTitle }) => (
            <div key={rowTitle} className="flex items-center gap-[12px] px-[14px] py-[12px]">
              <RowIcon size={18} className="shrink-0 text-muted-foreground" aria-hidden />
              <span className="text-[14px] leading-[20px] text-foreground">{rowTitle}</span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="flex flex-col gap-[8px]">{children}</div>
    </div>
  )
}
