import { setActiveSource } from "@/lib/source/active"
import { mountRecapPanel } from "@/lib/source/mount"
import { youtubeSource } from "@/lib/source/youtube"
import { setVideoResolver } from "@/lib/youtube/player"

export default defineContentScript({
  matches: ["*://www.youtube.com/*"],
  cssInjectionMode: "manual",
  runAt: "document_idle",
  async main(ctx) {
    setActiveSource(youtubeSource)
    setVideoResolver(null)
    await mountRecapPanel(ctx, {
      placement: "sidebar",
      anchor: "#secondary-inner",
      append: "first",
    })
  },
})
