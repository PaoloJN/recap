import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "wxt"

const REM_BASE_PX = 14

const remToPx = {
  postcssPlugin: "rem-to-px",
  Declaration(decl: { value: string }) {
    if (!decl.value.includes("rem")) return
    decl.value = decl.value.replace(
      /(\d*\.?\d+)rem/g,
      (_: string, n: string) => `${Number(n) * REM_BASE_PX}px`,
    )
  },
}

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "YouTube AI",
    version: "2.0.0",
    permissions: ["storage"],
    host_permissions: [
      "https://api.openai.com/*",
      "https://api.anthropic.com/*",
      "https://generativelanguage.googleapis.com/*",
    ],
    icons: {
      16: "icon/16.png",
      32: "icon/32.png",
      48: "icon/48.png",
      96: "icon/96.png",
      128: "icon/128.png",
    },
    commands: {
      "toggle-panel": {
        suggested_key: { default: "Alt+Shift+Y" },
        description: "Toggle the YouTube AI panel",
      },
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
    css: { postcss: { plugins: [remToPx] } },
  }),
})
