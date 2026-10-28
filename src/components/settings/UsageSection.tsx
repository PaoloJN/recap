import { usePro } from "@/hooks/usePro"
import { useStorageItem } from "@/hooks/useStorageItem"
import { usageLine } from "@/lib/pro/plan-copy"
import { monthKey, usageItem } from "@/lib/storage"
import type { ProviderId } from "@/lib/types"
import { SettingsSection } from "./SettingsSection"
import { resetsLabel, usageSummaryLine } from "./usage-format"

const EMPTY = { tokens: 0, summaries: 0, chats: 0 }

function Body({ title, line, sub }: { title: string; line: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-[2px] px-[14px] py-[12px]">
      <span className="text-[14px] leading-[20px] text-foreground">{title}</span>
      <span className="text-[12px] leading-[16px] text-muted-foreground">{line}</span>
      {sub ? (
        <span className="text-[12px] leading-[16px] text-subtle-foreground">{sub}</span>
      ) : null}
    </div>
  )
}

export function UsageSection({ provider }: { provider: ProviderId }) {
  const [usage] = useStorageItem(usageItem)
  const { me } = usePro()
  const now = new Date()
  if (provider === "pro" && me) {
    return (
      <SettingsSection label="Usage" footnote="Counted by Recap Pro.">
        <Body title="This month" line={usageLine(me, now.getTime())} />
      </SettingsSection>
    )
  }
  const month = usage?.[monthKey(now)] ?? EMPTY
  return (
    <SettingsSection label="Usage" footnote="Counted from the token usage your provider reports.">
      <Body title="This month" line={usageSummaryLine(month)} sub={resetsLabel(now)} />
    </SettingsSection>
  )
}
