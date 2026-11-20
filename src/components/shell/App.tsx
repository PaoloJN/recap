import { ChatDraftProvider } from "@/components/chat/ChatDraftContext"
import { TooltipProvider } from "@/components/ui/tooltip"
import { LayoutFrame, LayoutProvider } from "./LayoutContext"
import { NavigationProvider } from "./NavigationContext"
import { Panel } from "./Panel"
import { PortalContainerContext } from "./PortalContainer"
import { ToastProvider } from "./ToastContext"

export interface AppProps {
  container: HTMLElement
}

export function App({ container }: AppProps) {
  return (
    <PortalContainerContext.Provider value={container}>
      <TooltipProvider delayDuration={300}>
        <NavigationProvider>
          <LayoutProvider container={container}>
            {/* Box-equal to the card, so the toast sits inside the card's corner. */}
            <LayoutFrame>
              <ToastProvider>
                <ChatDraftProvider>
                  <Panel />
                </ChatDraftProvider>
              </ToastProvider>
            </LayoutFrame>
          </LayoutProvider>
        </NavigationProvider>
      </TooltipProvider>
    </PortalContainerContext.Provider>
  )
}
