import { createRoot } from "react-dom/client"
import { browser } from "wxt/browser"
import "@/assets/tailwind.css"
import { injectFontFaces } from "@/lib/fonts"
import { Welcome } from "./Welcome"

injectFontFaces()
const dark = window.matchMedia("(prefers-color-scheme: dark)")
const applyTheme = () => document.documentElement.classList.toggle("dark", dark.matches)
applyTheme()
dark.addEventListener("change", applyTheme)

const root = document.getElementById("root")
if (root) {
  createRoot(root).render(
    <Welcome
      shortcut={navigator.platform.startsWith("Mac") ? "⌥ Y" : "Alt+Y"}
      pro={Boolean(import.meta.env.WXT_PRO_ORIGIN)}
      iconUrl={browser.runtime.getURL("/icon/128.png")}
    />,
  )
}
