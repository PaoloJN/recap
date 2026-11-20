import { activeOrGeneric, setActiveSource } from "@/lib/source/active"
import { mountRecapPanel } from "@/lib/source/mount"
import { COURSE_MATCHES, sourceForUrl } from "@/lib/source/registry"
import { setVideoResolver } from "@/lib/youtube/player"

export default defineContentScript({
  matches: [...COURSE_MATCHES],
  cssInjectionMode: "manual",
  runAt: "document_idle",
  async main(ctx) {
    const source = activeOrGeneric(location.href, sourceForUrl(location.href))
    setActiveSource(source)
    setVideoResolver((doc) => source.getVideoElement(doc))
    await mountRecapPanel(ctx, {
      placement: "drawer",
      anchor: "body",
      append: "last",
    })
  },
})
