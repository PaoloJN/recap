import type { ReactNode } from "react"

export interface SettingsSectionProps {
  label: string
  children: ReactNode
  /** 11px subtle line under the card. */
  footnote?: ReactNode
  id?: string
}

/** Section label above a card of rows separated by 1px dividers. */
export function SettingsSection({ label, children, footnote, id }: SettingsSectionProps) {
  return (
    <section id={id} className="flex flex-col gap-[8px]">
      <h3 className="px-[4px] text-[13px] leading-[18px] font-medium text-muted-foreground">
        {label}
      </h3>
      <div className="flex flex-col divide-y divide-border overflow-hidden rounded-[12px] border border-border bg-card">
        {children}
      </div>
      {footnote ? (
        <p className="px-[4px] text-[11px] leading-[16px] text-subtle-foreground">{footnote}</p>
      ) : null}
    </section>
  )
}
