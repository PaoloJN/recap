import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "wxt"
import { twPropertyDefaults } from "./src/build/tw-property-defaults"

const REM_BASE_PX = 14
const YOUTUBE_MATCHES = ["*://www.youtube.com/*"]

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
      "https://openrouter.ai/*",
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
        suggested_key: { default: "Alt+Y" },
        description: "Toggle the YouTube AI panel",
      },
    },
  },
  hooks: {
    // Only the bundled fonts need to be web accessible; the stylesheet is inlined into the
    // content script (see src/entrypoints/youtube.content/index.tsx).
    "build:manifestGenerated": (_wxt, manifest) => {
      manifest.web_accessible_resources = [
        {
          resources: ["fonts/*"],
          matches: YOUTUBE_MATCHES,
          use_dynamic_url: false,
        },
      ]
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
    css: { postcss: { plugins: [remToPx, twPropertyDefaults] } },
  }),
})
