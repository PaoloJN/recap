import { ChatDraftProvider } from "@/components/chat/ChatDraftContext"
import { TooltipProvider } from "@/components/ui/tooltip"
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
        {/* `relative` and box-equal to the card, so the toast sits inside the card's corner. */}
        <div className="relative mb-[12px] font-sans text-foreground antialiased">
          <ToastProvider>
            <NavigationProvider>
              <ChatDraftProvider>
                <Panel />
              </ChatDraftProvider>
            </NavigationProvider>
          </ToastProvider>
        </div>
      </TooltipProvider>
    </PortalContainerContext.Provider>
  )
}
