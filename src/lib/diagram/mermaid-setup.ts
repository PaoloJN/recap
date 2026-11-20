import mermaid from "mermaid"

/** Local Mermaid config. Strict mode sanitizes SVG; dagre avoids the ELK worker. */
export function configureMermaid(dark: boolean): void {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    suppressErrorRendering: true,
    htmlLabels: false,
    fontFamily: "Arial, sans-serif",
    theme: dark ? "dark" : "neutral",
    look: "classic",
    layout: "dagre",
    logLevel: "fatal",
  })
}
