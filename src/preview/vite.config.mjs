import path from "node:path"
import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"

const previewDir = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(previewDir, "../..")

// Repo root so Tailwind sees the same component classes as the extension build.
export default {
  root: repo,
  base: "./",
  publicDir: false,
  plugins: [tailwindcss()],
  resolve: { alias: { "@": path.resolve(repo, "src") } },
  esbuild: { jsx: "automatic" },
  build: {
    rollupOptions: { input: path.resolve(previewDir, "index.html") },
    outDir: path.resolve(repo, "dist-preview"),
    emptyOutDir: true,
  },
}
