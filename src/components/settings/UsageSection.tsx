import { useStorageItem } from "@/hooks/useStorageItem"
import { monthKey, usageItem } from "@/lib/storage"
import { SettingsSection } from "./SettingsSection"
import { resetsLabel, usageSummaryLine } from "./usage-format"

const EMPTY = { tokens: 0, summaries: 0, chats: 0 }

export function UsageSection() {
  const [usage] = useStorageItem(usageItem)
  const now = new Date()
  const month = usage?.[monthKey(now)] ?? EMPTY
  return (
    <SettingsSection label="Usage" footnote="Counted from the token usage your provider reports.">
      <div className="flex flex-col gap-[2px] px-[14px] py-[12px]">
        <span className="text-[14px] leading-[20px] text-foreground">This month</span>
        <span className="text-[12px] leading-[16px] text-muted-foreground">
          {usageSummaryLine(month)}
        </span>
        <span className="text-[12px] leading-[16px] text-subtle-foreground">
          {resetsLabel(now)}
        </span>
      </div>
    </SettingsSection>
  )
}
