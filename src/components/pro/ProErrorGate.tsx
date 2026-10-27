import type { Gate } from "./access"
import { LimitGate } from "./LimitGate"
import { SignedOutGate } from "./SignedOutGate"
import { UpgradeGate } from "./UpgradeGate"

/** The gate for a Recap Pro error code that replaces the body (see `gateFor`). */
export function ProErrorGate({
  gate,
  kind,
  resetsAt,
  onUpgraded,
}: {
  gate: Gate
  kind: "summary" | "chat"
  resetsAt: string | null | undefined
  onUpgraded(): void
}) {
  switch (gate) {
    case "upgrade":
      return <UpgradeGate kind={kind} onUpgraded={onUpgraded} />
    case "limit":
      return <LimitGate resetsAt={resetsAt} />
    case "signed-out":
      return <SignedOutGate />
  }
}
