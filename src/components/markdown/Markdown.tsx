import type { MouseEvent } from "react"
import { MessageResponse } from "@/components/ai-elements/message"
import { linkifyTimestamps, TIMESTAMP_HREF_PREFIX, timestampFromHref } from "@/lib/timestamps"
import { cn } from "@/lib/utils"
import { seekTo } from "@/lib/youtube/player"

function handleClick(event: MouseEvent<HTMLDivElement>) {
  if (!(event.target instanceof Element)) return
  const anchor = event.target.closest("a")
  const href = anchor?.getAttribute("href")
  if (!href?.startsWith(TIMESTAMP_HREF_PREFIX)) return
  event.preventDefault()
  const seconds = timestampFromHref(href)
  if (seconds !== null) seekTo(seconds)
}

const TIMESTAMP_CHIP =
  "[&_a[href^='#t=']]:rounded-sm [&_a[href^='#t=']]:bg-muted [&_a[href^='#t=']]:px-1 [&_a[href^='#t=']]:py-0.5 [&_a[href^='#t=']]:font-mono [&_a[href^='#t=']]:text-xs [&_a[href^='#t=']]:no-underline [&_a[href^='#t=']]:hover:bg-accent"

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: delegated handler for real anchor elements, which are natively keyboard-activatable
    // biome-ignore lint/a11y/noStaticElementInteractions: same
    <div className={cn("prose-sm", TIMESTAMP_CHIP, className)} onClick={handleClick}>
      <MessageResponse>{linkifyTimestamps(children)}</MessageResponse>
    </div>
  )
}
