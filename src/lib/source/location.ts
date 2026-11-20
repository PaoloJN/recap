/** Polls and hooks history so SPA lecture changes are visible. Restores the originals on cleanup. */
export function onLocationChange(cb: () => void, doc: Document = document): () => void {
  const view = doc.defaultView
  let href = doc.location.href
  const tick = () => {
    if (doc.location.href === href) return
    href = doc.location.href
    cb()
  }
  const timer = setInterval(tick, 500)
  view?.addEventListener("popstate", tick)
  const history = view?.history
  const push = history?.pushState
  const replace = history?.replaceState
  if (history && push && replace) {
    history.pushState = function (this: History, ...args: Parameters<History["pushState"]>) {
      const result = push.apply(this, args)
      tick()
      return result
    }
    history.replaceState = function (this: History, ...args: Parameters<History["replaceState"]>) {
      const result = replace.apply(this, args)
      tick()
      return result
    }
  }
  return () => {
    clearInterval(timer)
    view?.removeEventListener("popstate", tick)
    if (history && push) history.pushState = push
    if (history && replace) history.replaceState = replace
  }
}
