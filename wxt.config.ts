import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "wxt"
import { twPropertyDefaults } from "./src/build/tw-property-defaults"
import { proManifestAdditions } from "./src/lib/pro/manifest"
import { normalizeProOrigin } from "./src/lib/pro/origin"

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
  manifest: ({ browser }) => {
    // Read lazily: WXT loads .env files after evaluating this file but before calling this.
    const pro = proManifestAdditions(normalizeProOrigin(process.env.WXT_PRO_ORIGIN))
    return {
      name: "Recap AI",
      version: "2.0.0",
      permissions: ["storage", ...pro.permissions],
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
          description: "Toggle the Recap panel",
        },
      },
      ...(browser === "firefox"
        ? { browser_specific_settings: { gecko: { id: "recap-ai@paolojn.github.io" } } }
        : {}),
    }
  },
  hooks: {
    // Only the bundled fonts need to be web accessible; the stylesheet is inlined into the
    // content script (see src/entrypoints/youtube.content/index.tsx).
    "build:manifestGenerated": (wxt, manifest) => {
      // MV2 (the Firefox build) takes a plain string list; MV3 takes the object form.
      manifest.web_accessible_resources =
        wxt.config.manifestVersion === 2
          ? ["fonts/*"]
          : [{ resources: ["fonts/*"], matches: YOUTUBE_MATCHES, use_dynamic_url: false }]
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
    css: { postcss: { plugins: [remToPx, twPropertyDefaults] } },
  }),
})
