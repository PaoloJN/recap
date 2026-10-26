import { browser } from "wxt/browser"

const WEIGHTS = [400, 500] as const

export function injectFontFaces(
  doc: Document = document,
  getUrl: (path: string) => string = (p) => browser.runtime.getURL(`/${p}` as never),
): void {
  if (doc.head.querySelector("style[data-youtube-ai-fonts]")) return
  const style = doc.createElement("style")
  style.setAttribute("data-youtube-ai-fonts", "")
  style.textContent = WEIGHTS.map(
    (weight) => `@font-face {
  font-family: "Roboto Mono";
  font-style: normal;
  font-weight: ${weight};
  font-display: swap;
  src: url("${getUrl(`fonts/roboto-mono-${weight}.woff2`)}") format("woff2");
}`,
  ).join("\n")
  doc.head.appendChild(style)
}
