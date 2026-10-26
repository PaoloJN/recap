// Inlined so the shadow root never fetches a chrome-extension:// stylesheet at runtime
// (Chrome rejects that fetch from an orphaned content script after an extension reload).

import { createRoot, type Root } from "react-dom/client"
import { browser } from "wxt/browser"
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root"
import css from "@/assets/tailwind.css?inline"
import { App } from "@/components/shell/App"
import { injectFontFaces } from "@/lib/fonts"
import type { ToggleMessage } from "@/lib/port-protocol"
import { panelStateItem } from "@/lib/storage"

function isToggleMessage(msg: unknown): msg is ToggleMessage {
  return (msg as ToggleMessage | undefined)?.type === "toggle-panel"
}

export default defineContentScript({
  matches: ["*://www.youtube.com/*"],
  cssInjectionMode: "manual",
  runAt: "document_idle",
  async main(ctx) {
    injectFontFaces()
    const ui = await createShadowRootUi<Root>(ctx, {
      name: "recap-panel",
      css,
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
