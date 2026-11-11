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
  /** Clears the error behind the gate once the plan or usage no longer blocks it. */
  onUpgraded(): void
}) {
  switch (gate) {
    case "upgrade":
      return <UpgradeGate kind={kind} onUpgraded={onUpgraded} />
    case "limit":
      return <LimitGate kind={kind} resetsAt={resetsAt} onCleared={onUpgraded} />
    case "signed-out":
      return <SignedOutGate />
  }
}
