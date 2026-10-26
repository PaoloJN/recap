import * as React from "react"
import { cn } from "@/lib/utils"
import { Switch as SwitchPrimitive } from "radix-ui"

/** 36×20 track (on = link, off = muted) with a 16px white thumb (v3 design). */
function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-[20px] w-[36px] shrink-0 cursor-pointer items-center rounded-full border-0 p-[2px] transition-colors duration-150 ease-out outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-link data-[state=unchecked]:bg-muted",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-[16px] rounded-full bg-white ring-0 transition-transform duration-150 ease-out data-[state=checked]:translate-x-[16px] data-[state=unchecked]:translate-x-0"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
