import { useEffect } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useTheme } from "@/hooks/useTheme"
import { cn } from "@/lib/utils"
import { Panel } from "./Panel"
import { PortalContainerContext } from "./PortalContainer"

export interface AppProps {
  container: HTMLElement
}

export function App({ container }: AppProps) {
  const theme = useTheme()
  const dark = theme === "dark"

  // Portaled Select/Tooltip content renders into `container`, outside the app wrapper.
  useEffect(() => {
    container.classList.toggle("dark", dark)
    return () => {
      container.classList.remove("dark")
    }
  }, [container, dark])

  return (
    <PortalContainerContext.Provider value={container}>
      <TooltipProvider delayDuration={300}>
        <div className={cn("font-sans text-sm text-foreground antialiased", dark && "dark")}>
          <Panel />
        </div>
      </TooltipProvider>
    </PortalContainerContext.Provider>
  )
}
