import { createContext, type ReactNode, useContext } from "react"
import type { SummaryState } from "./useSummary"

const SummaryContext = createContext<SummaryState | null>(null)

export function SummaryProvider({ value, children }: { value: SummaryState; children: ReactNode }) {
  return <SummaryContext.Provider value={value}>{children}</SummaryContext.Provider>
}

export function useSummaryContext(): SummaryState {
  const value = useContext(SummaryContext)
  if (!value) throw new Error("useSummaryContext must be used inside a SummaryProvider")
  return value
}
