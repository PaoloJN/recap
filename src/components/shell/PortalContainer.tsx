import { createContext, useContext } from "react"

export const PortalContainerContext = createContext<HTMLElement | null>(null)

export function usePortalContainer(): HTMLElement | null {
  return useContext(PortalContainerContext)
}

/** The panel card: modal dialogs portal here so they dim and centre within the card only. */
export const DialogContainerContext = createContext<HTMLElement | null>(null)

export function useDialogContainer(): HTMLElement | null {
  return useContext(DialogContainerContext)
}
