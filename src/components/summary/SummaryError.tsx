import { WarningCircle } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { primaryButton, secondaryButton, smallButton } from "./buttons"

export interface SummaryErrorProps {
  /** Overrides the default `Can't reach {provider}` title. */
  title?: string
  providerLabel?: string
  message: string
  /** Overrides the default "Retry, or switch to another model." suffix. */
  hint?: string
  onRetry(): void
  onSwitchModel?: () => void
}

export function SummaryError({
  title,
  providerLabel,
  message,
  hint = "Retry, or switch to another model.",
  onRetry,
  onSwitchModel,
}: SummaryErrorProps) {
  return (
    <div role="alert" className="flex flex-col gap-[12px] rounded-[12px] bg-danger-soft p-[16px]">
      <div className="flex items-center gap-[8px]">
        <WarningCircle
          weight="fill"
          className="size-[18px] shrink-0 text-destructive"
          aria-hidden
        />
        <span className="text-[14px] font-medium text-foreground">
          {title ?? `Can't reach ${providerLabel ?? "the provider"}`}
        </span>
      </div>
      <p className="text-[14px] leading-[21px] text-pretty text-card-foreground">
        {message} {hint}
      </p>
      <div className="flex gap-[8px]">
        <button type="button" className={cn(primaryButton, smallButton)} onClick={onRetry}>
          Retry now
        </button>
        {onSwitchModel ? (
          <button
            type="button"
            className={cn(secondaryButton, smallButton)}
            onClick={onSwitchModel}
          >
            Switch model
          </button>
        ) : null}
      </div>
    </div>
  )
}
