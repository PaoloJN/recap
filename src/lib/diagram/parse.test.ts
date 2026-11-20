import { describe, expect, it } from "vitest"
import { extractMermaid, parseDiagramResponse, shortMermaidError } from "./parse"

const REPLY = `
Here is a diagram.

\`\`\`mermaid
flowchart TD
  A["Trình duyệt"] --> B["API Gateway"]
  B --> C["Worker"]
\`\`\`

## Mốc thời gian
- Trình duyệt — 0:12
- API Gateway — 0:28
- Worker - 0:45
- Not a time — nope
`

describe("extractMermaid", () => {
  it("reads a mermaid fence", () => {
    expect(extractMermaid(REPLY)).toBe(
      ["flowchart TD", '  A["Trình duyệt"] --> B["API Gateway"]', '  B --> C["Worker"]'].join("\n"),
    )
  })

  it("reads an untagged fence and a bare diagram", () => {
    expect(extractMermaid("```\nsequenceDiagram\n  A->>B: Hi\n```")).toBe(
      "sequenceDiagram\n  A->>B: Hi",
    )
    expect(extractMermaid("flowchart LR\n  A --> B")).toBe("flowchart LR\n  A --> B")
  })

  it("returns null when there is no diagram", () => {
    expect(extractMermaid("Just a paragraph about Kafka.")).toBeNull()
  })
})

describe("parseDiagramResponse", () => {
  it("pairs labels with timestamps and skips the mermaid block", () => {
    const { code, links } = parseDiagramResponse(REPLY)
    expect(code).toContain("API Gateway")
    expect(links).toEqual([
      { label: "Trình duyệt", seconds: 12 },
      { label: "API Gateway", seconds: 28 },
      { label: "Worker", seconds: 45 },
    ])
  })

  it("accepts h:mm:ss", () => {
    const { links } = parseDiagramResponse("- Bộ đệm — 1:02:03")
    expect(links).toEqual([{ label: "Bộ đệm", seconds: 3723 }])
  })

  it("returns no links when the list is missing", () => {
    expect(parseDiagramResponse("```mermaid\nflowchart TD\n  A --> B\n```").links).toEqual([])
  })
})

describe("shortMermaidError", () => {
  it("keeps the first line and drops the trailing colon", () => {
    expect(shortMermaidError("Parse error on line 3:\nExpecting NODE")).toBe(
      "Parse error on line 3",
    )
  })

  it("falls back when the message is blank", () => {
    expect(shortMermaidError("  \n")).toBe("Mermaid could not parse this diagram.")
  })
})
