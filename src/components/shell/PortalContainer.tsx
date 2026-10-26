import { createContext, useContext } from "react"

export const PortalContainerContext = createContext<HTMLElement | null>(null)

export function usePortalContainer(): HTMLElement | null {
  return useContext(PortalContainerContext)
}
