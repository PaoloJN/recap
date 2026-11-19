import { describe, expect, it } from "vitest"
import {
  clickedNodeId,
  edgeLines,
  nodeForLabel,
  nodeFromDomId,
  parseDiagramGraph,
  secondsForLabel,
} from "./graph"
import { isDiagramNodeClick, isTrustedDiagramEvent } from "./protocol"

const flow = `flowchart TD
  A["API Gateway"] -->|HTTP| B["Worker"]
  B --> C["Redis"]
  A -- calls --> B
  Choice{Pick} -->|yes| Done[Xong]
`

describe("parseDiagramGraph", () => {
  it("reads flowchart labels and edges from the source", () => {
    const graph = parseDiagramGraph(flow)
    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        { id: "A", label: "API Gateway" },
        { id: "B", label: "Worker" },
        { id: "C", label: "Redis" },
        { id: "Choice", label: "Pick" },
        { id: "Done", label: "Xong" },
      ]),
    )
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        { from: "A", to: "B", label: "HTTP" },
        { from: "B", to: "C", label: "" },
        { from: "A", to: "B", label: "calls" },
        { from: "Choice", to: "Done", label: "yes" },
      ]),
    )
  })

  it("keeps the longer node id when one id is a prefix of another", () => {
    const graph = parseDiagramGraph(`flowchart LR
      API["API"] --> APIGW["API Gateway"]
    `)
    expect(nodeFromDomId("recapDiagram1-flowchart-APIGW-0", graph.nodes)?.label).toBe("API Gateway")
    expect(nodeFromDomId("recapDiagram1-flowchart-API-1", graph.nodes)?.label).toBe("API")
  })

  it("reads sequence, state, class, and er diagrams", () => {
    expect(
      parseDiagramGraph(`sequenceDiagram
        participant U as User
        participant API as API Gateway
        U->>API: request
        API-->>U: response
      `).edges,
    ).toEqual([
      { from: "U", to: "API", label: "request" },
      { from: "API", to: "U", label: "response" },
    ])
    const state = parseDiagramGraph(`stateDiagram-v2
      [*] --> Idle
      state "Running job" as Running
      Idle --> Running : start
    `)
    expect(state.nodes).toEqual(
      expect.arrayContaining([
        { id: "Running", label: "Running job" },
        { id: "Idle", label: "Idle" },
      ]),
    )
    expect(state.edges).toEqual(
      expect.arrayContaining([
        { from: "[*]", to: "Idle", label: "" },
        { from: "Idle", to: "Running", label: "start" },
      ]),
    )
    const klass = parseDiagramGraph(`classDiagram
      class User {
        +id
      }
      class Order
      User --> Order : places
    `)
    expect(klass.nodes.map((node) => node.id).sort()).toEqual(["Order", "User"])
    expect(klass.edges).toEqual([{ from: "User", to: "Order", label: "places" }])
    expect(parseDiagramGraph("erDiagram\n  USER ||--o{ ORDER : places").edges).toEqual([
      { from: "USER", to: "ORDER", label: "places" },
    ])
  })
})

describe("node identity", () => {
  const graph = parseDiagramGraph(flow)

  it("maps renderer DOM ids back to source nodes", () => {
    expect(nodeFromDomId("recapDiagram3-flowchart-A-0", graph.nodes)?.label).toBe("API Gateway")
    expect(nodeFromDomId("classId-User-2", [{ id: "User", label: "User" }])?.id).toBe("User")
    expect(nodeFromDomId("state-Idle-0", [{ id: "Idle", label: "Idle" }])?.id).toBe("Idle")
    expect(nodeFromDomId("Worker", graph.nodes)?.id).toBe("B")
  })

  it("reads a node id from a click target", () => {
    document.body.innerHTML = `
      <svg>
        <g class="edgePaths"><path id="edge-0"></path></g>
        <g id="recapDiagram1-flowchart-A-0" class="node"><rect></rect><text>API</text></g>
        <g><line data-id="API"></line><g><rect id="actor-box"></rect></g></g>
      </svg>`
    const text = document.querySelector("text")
    const actor = document.getElementById("actor-box")
    const edge = document.querySelector("path")
    expect(clickedNodeId(text)).toBe("recapDiagram1-flowchart-A-0")
    expect(clickedNodeId(actor)).toBe("API")
    expect(clickedNodeId(edge)).toBeNull()
  })

  it("describes a node's edges and timestamp", () => {
    const node = nodeForLabel("Worker", graph)
    expect(node).toEqual({ id: "B", label: "Worker" })
    expect(edgeLines(node, graph)).toEqual([
      "API Gateway -- HTTP --> Worker",
      "Worker --> Redis",
      "API Gateway -- calls --> Worker",
    ])
    expect(secondsForLabel("Worker", [{ label: "Worker", seconds: 28 }])).toBe(28)
    expect(secondsForLabel("Missing", [])).toBeNull()
  })
})

describe("diagram click messages", () => {
  const frame = {}
  it("accepts a node click only from the extension iframe", () => {
    expect(
      isDiagramNodeClick({ source: "recap-diagram", type: "node-click", nodeId: "A", x: 1, y: 2 }),
    ).toBe(true)
    expect(
      isDiagramNodeClick({ source: "other", type: "node-click", nodeId: "A", x: 1, y: 2 }),
    ).toBe(false)
    expect(
      isTrustedDiagramEvent(
        { origin: "chrome-extension://abc", source: frame },
        frame,
        "chrome-extension://abc",
      ),
    ).toBe(true)
    expect(
      isTrustedDiagramEvent(
        { origin: "https://www.youtube.com", source: frame },
        frame,
        "chrome-extension://abc",
      ),
    ).toBe(false)
    expect(
      isTrustedDiagramEvent(
        { origin: "chrome-extension://abc", source: {} },
        frame,
        "chrome-extension://abc",
      ),
    ).toBe(false)
  })
})
