import { describe, expect, it } from "vitest"
import { injectFontFaces } from "./fonts"

describe("injectFontFaces", () => {
  it("appends one style tag with two Roboto Mono faces", () => {
    const doc = document.implementation.createHTMLDocument("")
    injectFontFaces(doc, (p) => `chrome-extension://id/${p}`)
    injectFontFaces(doc, (p) => `chrome-extension://id/${p}`)
    const styles = doc.head.querySelectorAll("style[data-youtube-ai-fonts]")
    expect(styles).toHaveLength(1)
    expect(styles[0]?.textContent).toContain('font-family: "Roboto Mono"')
    expect(styles[0]?.textContent).toContain("chrome-extension://id/fonts/roboto-mono-500.woff2")
    expect(styles[0]?.textContent).toContain("font-weight: 500")
  })
})
