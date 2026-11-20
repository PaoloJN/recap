import { createRoot, type Root } from "react-dom/client"
import { browser } from "wxt/browser"
import type { ContentScriptContext } from "wxt/utils/content-script-context"
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root"
import css from "@/assets/tailwind.css?inline"
import { App, type AppProps } from "@/components/shell/App"
import { injectFontFaces } from "@/lib/fonts"
import { clearPageLayout } from "@/lib/layout/page-style"
import type { ToggleMessage } from "@/lib/port-protocol"
import { panelStateItem } from "@/lib/storage"

export const PENDING_TOGGLE_KEY = "recap-pending-toggle"

function isToggleMessage(msg: unknown): msg is ToggleMessage {
  const type = (msg as ToggleMessage | undefined)?.type
  return type === "toggle-panel" || type === "explain-moment" || type === "focus-mode"
}

export function consumePendingToggle(): boolean {
  try {
    if (sessionStorage.getItem(PENDING_TOGGLE_KEY) !== "1") return false
    sessionStorage.removeItem(PENDING_TOGGLE_KEY)
    return true
  } catch {
    return false
  }
}

function openPanel() {
  void panelStateItem.getValue().then((state) => panelStateItem.setValue({ ...state, open: true }))
}

/** Shared shadow-root mount for the YouTube sidebar and the course drawer. */
export async function mountRecapPanel(
  ctx: ContentScriptContext,
  options: {
    placement: NonNullable<AppProps["placement"]>
    anchor: string
    append: "first" | "last"
  },
): Promise<void> {
  injectFontFaces()
  const ui = await createShadowRootUi<Root>(ctx, {
    name: "recap-panel",
    css: `${css}\n:host{display:block !important;}`,
    position: "inline",
    anchor: options.anchor,
    append: options.append,
    isolateEvents: true,
    onMount(container) {
      const root = createRoot(container)
      root.render(<App container={container} placement={options.placement} />)
      return root
    },
    onRemove(root) {
      root?.unmount()
    },
  })
  ui.autoMount()

  const onMessage = (msg: unknown) => {
    if (!isToggleMessage(msg)) return
    if (msg.type === "explain-moment") {
      void panelStateItem
        .getValue()
        .then((state) => panelStateItem.setValue({ ...state, open: true, tab: "chat" }))
      document.dispatchEvent(new CustomEvent("recap-explain-moment"))
      return
    }
    if (msg.type === "focus-mode") {
      document.dispatchEvent(new CustomEvent("recap-focus-mode"))
      return
    }
    void panelStateItem
      .getValue()
      .then((state) => panelStateItem.setValue({ ...state, open: !state.open }))
  }
  browser.runtime.onMessage.addListener(onMessage)
  ctx.onInvalidated(() => {
    browser.runtime.onMessage.removeListener(onMessage)
    clearPageLayout(document)
  })

  if (consumePendingToggle()) openPanel()
}
