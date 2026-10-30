import { getVideoElement } from "@/lib/youtube/player"

/**
 * The video to come back to after signing in or upgrading: a watch URL with only `v`, or a shorts
 * URL's path, plus `t=<whole seconds>` once playback is past the start. Null off a video page.
 * The website validates it again before using it.
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
  let back: URL
  if (url.pathname === "/watch") {
    const id = url.searchParams.get("v")
    if (!id) return null
    back = new URL("/watch", url.origin)
    back.searchParams.set("v", id)
  } else if (/^\/shorts\/[^/]+/.test(url.pathname)) {
    back = new URL(url.pathname, url.origin)
  } else {
    return null
  }
  const seconds = Math.floor(getVideoElement(doc)?.currentTime ?? 0)
  if (seconds > 0) back.searchParams.set("t", String(seconds))
  return back.toString()
}

/** The website's plan page, coming back to `returnUrl` afterwards when there is one. */
export function connectPath(returnUrl: string | null): string {
  return returnUrl ? `/connect?return=${encodeURIComponent(returnUrl)}` : "/connect"
}
