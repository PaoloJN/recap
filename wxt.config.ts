import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "wxt"
import { twPropertyDefaults } from "./src/build/tw-property-defaults"

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
    name: "Recap AI",
    // CI sets RECAP_VERSION to 2.0.<run_number> so each main push is a newer Chrome version.
    version: process.env.RECAP_VERSION ?? "2.0.0",
    // webNavigation reads the ChatGPT loopback redirect; tabs opens and closes that sign-in tab.
    // scripting injects the generic course script after the user allows an origin.
    permissions: ["storage", "webNavigation", "tabs", "scripting"],
    host_permissions: [
      "https://api.openai.com/*",
      "https://auth.openai.com/*",
      "https://api.anthropic.com/*",
      "https://generativelanguage.googleapis.com/*",
      "https://openrouter.ai/*",
      "https://www.udemy.com/*",
      "https://*.udemycdn.com/*",
      "https://vtt.udemy.com/*",
      "https://www.coursera.org/*",
      "https://d3c33hcgiwev3.cloudfront.net/*",
      "https://learn.deeplearning.ai/*",
      // Release lookup and the version.json download (GitHub redirects the asset).
      "https://api.github.com/*",
      "https://github.com/*",
      "https://objects.githubusercontent.com/*",
      "https://release-assets.githubusercontent.com/*",
    ],
    optional_host_permissions: ["https://*/*", "http://*/*"],
    action: {
      default_title: "Recap AI",
    },
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
      "explain-moment": {
        suggested_key: { default: "Alt+E" },
        description: "Explain this moment",
      },
      "focus-mode": {
        suggested_key: { default: "Alt+Shift+F" },
        description: "Phóng to chat",
      },
    },
  },
  hooks: {
    // Only the bundled fonts need to be web accessible; the stylesheet is inlined into the
    // content script (see src/entrypoints/youtube.content/index.tsx).
    "build:manifestGenerated": (_wxt, manifest) => {
      manifest.web_accessible_resources = [
        {
          // diagram-renderer.html is an extension page the content script iframes so Mermaid
          // (bundled locally) can render outside the YouTube page.
          resources: ["fonts/*", "diagram-renderer.html"],
          // Not a host permission. Fonts and the diagram renderer must load on course pages
          // and on origins the user allows later, which cannot be listed here in advance.
          matches: ["https://*/*", "http://*/*"],
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
