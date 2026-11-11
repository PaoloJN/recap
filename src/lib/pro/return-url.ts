import { getVideoElement } from "@/lib/youtube/player"

// Mirrors recap-website's `safeReturnUrl`, which rebuilds `return` and drops anything else.
const VIDEO_ID = /^[A-Za-z0-9_-]{1,64}$/
const SHORTS_PATH = /^\/shorts\/([^/]+)$/

/**
 * The video to come back to after signing in or upgrading: a watch URL with only `v`, plus
 * `t=<whole seconds>` once playback is past the start, or a bare shorts URL (the website keeps no
 * time for shorts). Null off a video page. The website validates it again before using it.
 */
export function currentReturnUrl(
  href: string = location.href,
  doc: Document = document,
): string | null {
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return null
  }
  if (url.pathname === "/watch") {
    const id = url.searchParams.get("v")
    if (!id || !VIDEO_ID.test(id)) return null
    const back = new URL("/watch", url.origin)
    back.searchParams.set("v", id)
    const seconds = Math.floor(getVideoElement(doc)?.currentTime ?? 0)
    if (seconds > 0) back.searchParams.set("t", String(seconds))
    return back.toString()
  }
  const shortsId = SHORTS_PATH.exec(url.pathname)?.[1]
  if (shortsId && VIDEO_ID.test(shortsId)) return `${url.origin}/shorts/${shortsId}`
  return null
}

/** The website's plan page, coming back to `returnUrl` afterwards when there is one. */
export function connectPath(returnUrl: string | null): string {
  return returnUrl ? `/connect?return=${encodeURIComponent(returnUrl)}` : "/connect"
}
