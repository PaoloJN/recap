import type { Icon } from "@phosphor-icons/react"
import type { ReactNode } from "react"

export interface EmptyStateProps {
  icon: Icon
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon: StateIcon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-8 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <StateIcon className="size-5" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{title}</p>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}
