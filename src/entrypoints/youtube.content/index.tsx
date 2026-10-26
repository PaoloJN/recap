import "@/assets/tailwind.css"
import { createRoot, type Root } from "react-dom/client"
import { browser } from "wxt/browser"
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root"
import { App } from "@/components/shell/App"
import type { ToggleMessage } from "@/lib/port-protocol"
import { panelStateItem } from "@/lib/storage"

function isToggleMessage(msg: unknown): msg is ToggleMessage {
  return (msg as ToggleMessage | undefined)?.type === "toggle-panel"
}

export default defineContentScript({
  matches: ["*://www.youtube.com/*"],
  cssInjectionMode: "ui",
  runAt: "document_idle",
  async main(ctx) {
    const ui = await createShadowRootUi<Root>(ctx, {
      name: "youtube-ai-panel",
      position: "inline",
      anchor: "#secondary-inner",
      append: "first",
      isolateEvents: true,
      onMount(container) {
        const root = createRoot(container)
        root.render(<App container={container} />)
        return root
      },
      onRemove(root) {
        root?.unmount()
      },
    })
    ui.autoMount()

    const onMessage = (msg: unknown) => {
      if (!isToggleMessage(msg)) return
      void panelStateItem.getValue().then((s) => panelStateItem.setValue({ ...s, open: !s.open }))
    }
    browser.runtime.onMessage.addListener(onMessage)
    ctx.onInvalidated(() => browser.runtime.onMessage.removeListener(onMessage))
  },
})
