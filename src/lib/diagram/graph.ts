import type { DiagramLink } from "@/lib/types"

export interface DiagramGraphNode {
  id: string
  label: string
}

export interface DiagramGraphEdge {
  from: string
  to: string
  label: string
}

export interface DiagramGraph {
  nodes: DiagramGraphNode[]
  edges: DiagramGraphEdge[]
}

const ID_SRC = String.raw`(?:\[\*\]|[A-Za-z_](?:[A-Za-z0-9_]|-(?!-|>))*)`
const ID_RE = new RegExp(ID_SRC, "g")
const ID_AT_START = new RegExp(`^${ID_SRC}`)
const KEYWORDS = new Set([
  "flowchart",
  "graph",
  "sequenceDiagram",
  "classDiagram",
  "erDiagram",
  "stateDiagram",
  "stateDiagram-v2",
  "subgraph",
  "end",
  "direction",
  "TD",
  "TB",
  "LR",
  "RL",
  "BT",
])

const OPENS: { open: string; close: string }[] = [
  { open: "[[", close: "]]" },
  { open: "([", close: "])" },
  { open: "[(", close: ")]" },
  { open: "((", close: "))" },
  { open: "{{", close: "}}" },
  { open: "[/", close: "/]" },
  { open: "[/", close: "\\]" },
  { open: "[\\", close: "/]" },
  { open: "[\\", close: "\\]" },
  { open: "[", close: "]" },
  { open: "(", close: ")" },
  { open: "{", close: "}" },
  { open: ">", close: "]" },
]

function readWrapped(
  input: string,
  open: string,
  close: string,
): { inner: string; length: number } | null {
  if (!input.startsWith(open)) return null
  let quote: '"' | "'" | null = null
  for (let i = open.length; i < input.length; i++) {
    const ch = input[i]
    if (quote) {
      if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      continue
    }
    if (input.startsWith(close, i)) {
      return { inner: input.slice(open.length, i), length: i + close.length }
    }
  }
  return null
}

function readShape(rest: string): { inner: string; length: number } | null {
  for (const { open, close } of OPENS) {
    const wrapped = readWrapped(rest, open, close)
    if (wrapped) return wrapped
  }
  return null
}

function cleanLabel(raw: string): string {
  let text = raw.trim()
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1)
  }
  return text
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/#quot;|&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim()
}

function remember(nodes: Map<string, string>, id: string, label?: string) {
  if (!id || KEYWORDS.has(id)) return
  const next = label ? cleanLabel(label) : ""
  const current = nodes.get(id)
  if (next) nodes.set(id, next)
  else if (!current) nodes.set(id, id)
}

function stripShapes(line: string): string {
  let out = ""
  let i = 0
  while (i < line.length) {
    const slice = line.slice(i)
    const id = ID_AT_START.exec(slice)
    if (!id) {
      out += line[i]
      i += 1
      continue
    }
    const shape = readShape(slice.slice(id[0].length))
    out += id[0]
    i += id[0].length + (shape?.length ?? 0)
  }
  return out
}

function scanShapes(line: string, nodes: Map<string, string>) {
  let i = 0
  while (i < line.length) {
    const slice = line.slice(i)
    const id = ID_AT_START.exec(slice)
    if (!id) {
      i += 1
      continue
    }
    const shape = readShape(slice.slice(id[0].length))
    if (shape) remember(nodes, id[0], shape.inner)
    i += id[0].length + (shape?.length ?? 0)
  }
}

function idsIn(fragment: string): string[] {
  return [...fragment.matchAll(ID_RE)].map((match) => match[0]).filter((id) => !KEYWORDS.has(id))
}

const EDGE_OP = /\s*(?:--\s+(.+?)\s+)?(<-->|<--|-\.->|==>|---|--[ox]|-->)\s*(?:\|([^|]*)\|)?\s*/g

function parseEdgeChain(line: string, nodes: Map<string, string>): DiagramGraphEdge[] {
  const text = stripShapes(line)
  const edges: DiagramGraphEdge[] = []
  const parts: { from: string; label: string; both: boolean; reverse: boolean }[] = []
  let last = 0
  for (const match of text.matchAll(EDGE_OP)) {
    const from = idsIn(text.slice(last, match.index)).at(-1)
    last = (match.index ?? 0) + match[0].length
    if (!from) continue
    parts.push({
      from,
      label: (match[3] || match[1] || "").trim(),
      both: match[2] === "<-->",
      reverse: match[2] === "<--",
    })
  }
  const tail = idsIn(text.slice(last))[0]
  parts.forEach((part, index) => {
    const to = index + 1 < parts.length ? parts[index + 1]?.from : tail
    if (!to) return
    remember(nodes, part.from)
    remember(nodes, to)
    const from = part.reverse ? to : part.from
    const target = part.reverse ? part.from : to
    edges.push({ from, to: target, label: part.label })
    if (part.both) edges.push({ from: target, to: from, label: part.label })
  })
  return edges
}

function skipFlowLine(line: string): boolean {
  return /^(?:%%|style\b|classDef\b|class\b|linkStyle\b|click\b|direction\b|accTitle\b|accDescr\b|subgraph\b|end\b)/.test(
    line,
  )
}

function parseFlow(lines: string[]): DiagramGraph {
  const nodes = new Map<string, string>()
  const edges: DiagramGraphEdge[] = []
  for (const line of lines) {
    if (skipFlowLine(line) || /^(?:flowchart|graph)\b/.test(line)) continue
    scanShapes(line, nodes)
    edges.push(...parseEdgeChain(line, nodes))
  }
  return toGraph(nodes, edges)
}

function parseSequence(lines: string[]): DiagramGraph {
  const nodes = new Map<string, string>()
  const edges: DiagramGraphEdge[] = []
  const message = new RegExp(
    `^(${ID_SRC})\\s*(-->>|->>|-->|->|--x|-x|--\\)|-\\))\\s*(${ID_SRC})\\s*:\\s*(.*)$`,
  )
  for (const line of lines) {
    const named = new RegExp(`^(?:participant|actor)\\s+(${ID_SRC})(?:\\s+as\\s+(.+))?$`, "i").exec(
      line,
    )
    if (named) {
      remember(nodes, named[1] ?? "", named[2] || named[1])
      continue
    }
    const msg = message.exec(line)
    if (!msg) continue
    const from = msg[1] ?? ""
    const to = msg[3] ?? ""
    remember(nodes, from)
    remember(nodes, to)
    edges.push({ from, to, label: (msg[4] ?? "").trim() })
  }
  return toGraph(nodes, edges)
}

function parseState(lines: string[]): DiagramGraph {
  const nodes = new Map<string, string>()
  const edges: DiagramGraphEdge[] = []
  for (const line of lines) {
    if (/^stateDiagram/.test(line)) continue
    const named = new RegExp(`^state\\s+"([^"]+)"\\s+as\\s+(${ID_SRC})$`).exec(line)
    if (named) {
      remember(nodes, named[2] ?? "", named[1])
      continue
    }
    if (skipFlowLine(line)) continue
    scanShapes(line, nodes)
    const edge = /^(.+?)\s+-->\s+(.+?)(?:\s*:\s*(.*))?$/.exec(stripShapes(line))
    if (!edge) continue
    const from = idsIn(edge[1] ?? "")[0]
    const to = idsIn(edge[2] ?? "")[0]
    if (!from || !to) continue
    remember(nodes, from)
    remember(nodes, to)
    edges.push({ from, to, label: (edge[3] ?? "").trim() })
  }
  return toGraph(nodes, edges)
}

function parseClass(lines: string[]): DiagramGraph {
  const nodes = new Map<string, string>()
  const edges: DiagramGraphEdge[] = []
  const source = lines
    .filter((line) => !/^classDiagram\b/.test(line))
    .join("\n")
    .replace(/\{[^}]*\}/g, "")
  for (const line of source
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)) {
    const declared = new RegExp(`^class\\s+(${ID_SRC})(?:\\["([^"]*)"\\]|\\[([^\\]]+)\\])?`).exec(
      line,
    )
    if (declared) {
      remember(nodes, declared[1] ?? "", declared[2] || declared[3] || declared[1])
      continue
    }
    const edge = new RegExp(`^(${ID_SRC})\\s+.+?\\s+(${ID_SRC})(?:\\s*:\\s*(.*))?$`).exec(line)
    if (!edge) continue
    remember(nodes, edge[1] ?? "")
    remember(nodes, edge[2] ?? "")
    edges.push({ from: edge[1] ?? "", to: edge[2] ?? "", label: (edge[3] ?? "").trim() })
  }
  return toGraph(nodes, edges)
}

function parseEr(lines: string[]): DiagramGraph {
  const nodes = new Map<string, string>()
  const edges: DiagramGraphEdge[] = []
  const row = new RegExp(`^(${ID_SRC})\\s+[|o{}]+\\s*--\\s*[|o{}]+\\s*(${ID_SRC})\\s*:\\s*(.*)$`)
  for (const line of lines) {
    const match = row.exec(line)
    if (!match) continue
    remember(nodes, match[1] ?? "")
    remember(nodes, match[2] ?? "")
    edges.push({ from: match[1] ?? "", to: match[2] ?? "", label: (match[3] ?? "").trim() })
  }
  return toGraph(nodes, edges)
}

function toGraph(nodes: Map<string, string>, edges: DiagramGraphEdge[]): DiagramGraph {
  return {
    nodes: [...nodes].map(([id, label]) => ({ id, label: label || id })),
    edges,
  }
}

function kindOf(header: string): "sequence" | "state" | "class" | "er" | "flow" {
  if (/^sequenceDiagram\b/.test(header)) return "sequence"
  if (/^stateDiagram/.test(header)) return "state"
  if (/^classDiagram\b/.test(header)) return "class"
  if (/^erDiagram\b/.test(header)) return "er"
  return "flow"
}

/** Nodes and edges from a Mermaid source. Labels come from the source, not the SVG. */
export function parseDiagramGraph(code: string): DiagramGraph {
  const lines = code
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/%%.*$/, "").trim())
    .filter(Boolean)
  const kind = kindOf(lines[0] ?? "")
  if (kind === "sequence") return parseSequence(lines)
  if (kind === "state") return parseState(lines)
  if (kind === "class") return parseClass(lines)
  if (kind === "er") return parseEr(lines)
  return parseFlow(lines)
}

/** Map a renderer DOM id (`…-flowchart-A-0`, `classId-User-1`, `state-Idle-0`, or a raw id) to a node. */
export function nodeFromDomId(
  domId: string,
  nodes: readonly DiagramGraphNode[],
): DiagramGraphNode | null {
  const exact =
    nodes.find((node) => node.id === domId) ?? nodes.find((node) => node.label === domId)
  if (exact) return exact
  const ranked = [...nodes].sort((a, b) => b.id.length - a.id.length)
  for (const node of ranked) {
    for (const prefix of ["flowchart-", "classId-", "state-"]) {
      const needle = prefix + node.id
      const at = domId.indexOf(needle)
      if (at < 0) continue
      const beforeOk = at === 0 || domId[at - 1] === "-"
      const after = domId.slice(at + needle.length)
      if (beforeOk && /^-\d+$/.test(after)) return node
    }
  }
  return null
}

const NODE_DOM_ID = /(?:^|-)(?:flowchart-|classId-|state-)/

/** The Mermaid DOM id under a click, or a sequence actor's data-id. */
export function clickedNodeId(start: Element | null): string | null {
  let el: Element | null = start
  while (el) {
    const tag = el.tagName.toLowerCase()
    if (tag === "svg" || tag === "body" || tag === "html") break
    const own = el.getAttribute("data-id")
    if (own) return own
    for (const child of el.children) {
      const marked = child.getAttribute("data-id")
      if (marked) return marked
    }
    const id = el.getAttribute("id") ?? ""
    if (id && NODE_DOM_ID.test(id)) return id
    el = el.parentElement
  }
  return null
}

export function nodeForLabel(label: string, graph: DiagramGraph): DiagramGraphNode {
  const norm = (value: string) => value.trim().toLowerCase()
  return (
    graph.nodes.find(
      (node) => norm(node.label) === norm(label) || norm(node.id) === norm(label),
    ) ?? {
      id: label,
      label,
    }
  )
}

export function edgesOf(id: string, graph: DiagramGraph): DiagramGraphEdge[] {
  return graph.edges.filter((edge) => edge.from === id || edge.to === id)
}

export function secondsForLabel(label: string, links: readonly DiagramLink[]): number | null {
  const norm = (value: string) => value.trim().toLowerCase()
  const hit = links.find((link) => norm(link.label) === norm(label))
  return hit?.seconds ?? null
}

export function edgeLines(node: DiagramGraphNode, graph: DiagramGraph): string[] {
  const labelOf = (id: string) => graph.nodes.find((item) => item.id === id)?.label ?? id
  return edgesOf(node.id, graph).map((edge) => {
    const left = labelOf(edge.from)
    const right = labelOf(edge.to)
    return edge.label ? `${left} -- ${edge.label} --> ${right}` : `${left} --> ${right}`
  })
}
