import { Play } from "@phosphor-icons/react"
import { cjk } from "@streamdown/cjk"
import { type ComponentProps, memo } from "react"
import { type Components, defaultComponents, type ExtraProps, Streamdown } from "streamdown"
import { usePortalContainer } from "@/components/shell/PortalContainer"
import { useSeek } from "@/hooks/useSeek"
import { linkifyTimestamps, timestampFromHref } from "@/lib/timestamps"
import { cn } from "@/lib/utils"

/** A `#t=` citation: a 24px chip that seeks the player. */
function TimestampChip({ href, seconds, children }: ComponentProps<"a"> & { seconds: number }) {
  const seek = useSeek()
  return (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault()
        seek(seconds)
      }}
      className="mx-[1px] inline-flex h-[24px] items-center gap-[4px] rounded-[6px] bg-link-soft px-[6px] align-middle font-mono text-[12px] leading-none font-medium text-link no-underline transition-colors duration-150 hover:bg-secondary"
    >
      <Play weight="fill" className="size-[9px] shrink-0" aria-hidden />
      {children}
    </a>
  )
}

function MarkdownLink(props: ComponentProps<"a"> & ExtraProps) {
  const seconds = props.href ? timestampFromHref(props.href) : null
  if (seconds !== null) {
    return (
      <TimestampChip href={props.href} seconds={seconds}>
        {props.children}
      </TimestampChip>
    )
  }
  // Ordinary links keep Streamdown's anchor (new tab, noreferrer).
  return <defaultComponents.a {...props} className={cn("text-link", props.className)} />
}

const components: Components = { a: MarkdownLink }
const plugins = { cjk }
// Link safety off: it renders links as hrefless buttons behind a modal, which breaks
// timestamp anchors.
const linkSafety = { enabled: false }

// A 7×14 blinking block after the last rendered block while a reply streams.
const CARET =
  "[&>*:last-child]:after:ml-[2px] [&>*:last-child]:after:inline-block [&>*:last-child]:after:h-[14px] [&>*:last-child]:after:w-[7px] [&>*:last-child]:after:bg-muted-foreground [&>*:last-child]:after:align-[-2px] [&>*:last-child]:after:content-[''] [&>*:last-child]:after:animate-[yt-blink_0.9s_steps(2)_infinite]"

export interface MarkdownProps {
  children: string
  className?: string
  /** Shows a blinking caret after the text (while a reply is streaming). */
  caret?: boolean
}

export const Markdown = memo(function Markdown({ children, className, caret }: MarkdownProps) {
  // Overlays (code/table/mermaid controls) portal into the shadow-root container.
  const portal = usePortalContainer()
  return (
    <Streamdown
      className={cn(
        "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        caret && CARET,
        className,
      )}
      components={components}
      plugins={plugins}
      linkSafety={linkSafety}
      portal={portal ?? undefined}
    >
      {linkifyTimestamps(children)}
    </Streamdown>
  )
})
