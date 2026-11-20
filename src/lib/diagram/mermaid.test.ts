import { describe, expect, it, vi } from "vitest"
import { resolveDiagram } from "./assess"
import { validateMermaid } from "./validate"

const GOOD = `flowchart TD
  A["Trình duyệt"] --> B["API Gateway"]
  B --> C["Worker"]`

const BROKEN = "flowchart TD\n  A -->"

const SEQUENCE = `sequenceDiagram
  participant B as Trình duyệt
  participant G as API Gateway
  B->>G: Gửi tin`

describe("validateMermaid", () => {
  it("accepts a flowchart with Vietnamese labels and English terms", async () => {
    await expect(validateMermaid(GOOD)).resolves.toEqual({ ok: true })
  })

  it("accepts a sequence diagram", async () => {
    await expect(validateMermaid(SEQUENCE)).resolves.toEqual({ ok: true })
  })

  it("rejects broken syntax with a parser message", async () => {
    const result = await validateMermaid(BROKEN)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/Parse error/)
  })

  it("rejects init directives, scripts, and click statements before parsing", async () => {
    const init = await validateMermaid(`${GOOD}\n%%{init: {"securityLevel":"loose"}}%%`)
    const script = await validateMermaid(`${GOOD}\n<script>alert(1)</script>`)
    const click = await validateMermaid(`${GOOD}\nclick A call window.oops`)
    expect(init.ok).toBe(false)
    expect(script.ok).toBe(false)
    expect(click.ok).toBe(false)
  })
})

describe("resolveDiagram", () => {
  const fenced = (code: string, links = "- Cổng — 0:12") =>
    ["```mermaid", code, "```", "", "## Mốc thời gian", links].join("\n")

  it("returns a valid diagram without calling repair", async () => {
    const repair = vi.fn()
    const result = await resolveDiagram(fenced(GOOD), validateMermaid, repair)
    expect(repair).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      status: "ok",
      links: [{ label: "Cổng", seconds: 12 }],
    })
    if (result.status === "ok") expect(result.code).toContain("API Gateway")
  })

  it("retries once and accepts the corrected diagram", async () => {
    const repair = vi.fn(async (input: { code: string; error: string }) => {
      expect(input.code).toContain("A -->")
      expect(input.error).toMatch(/Parse error/)
      return fenced(GOOD, "- Worker — 1:02")
    })
    const result = await resolveDiagram(fenced(BROKEN), validateMermaid, repair)
    expect(repair).toHaveBeenCalledOnce()
    expect(result.status).toBe("ok")
    if (result.status === "ok") {
      expect(result.code).toContain("Worker")
      expect(result.links).toEqual([{ label: "Worker", seconds: 62 }])
    }
  })

  it("keeps the first timestamp list when the fix drops it", async () => {
    const repair = vi.fn(async () => ["```mermaid", GOOD, "```"].join("\n"))
    const result = await resolveDiagram(
      fenced(BROKEN, "- API Gateway — 0:28"),
      validateMermaid,
      repair,
    )
    expect(result).toMatchObject({
      status: "ok",
      links: [{ label: "API Gateway", seconds: 28 }],
    })
  })

  it("stops after one failed repair and returns the raw code", async () => {
    const repair = vi.fn(async () => fenced("flowchart TD\n  B -->"))
    const result = await resolveDiagram(fenced(BROKEN), validateMermaid, repair)
    expect(repair).toHaveBeenCalledOnce()
    expect(result.status).toBe("invalid")
    if (result.status === "invalid") {
      expect(result.message).toMatch(/Parse error/)
      expect(result.code).toContain("B -->")
      expect(result.raw).toContain("```mermaid")
    }
  })

  it("does not retry when the reply has no diagram", async () => {
    const repair = vi.fn()
    const result = await resolveDiagram("Sorry, I cannot draw that.", validateMermaid, repair)
    expect(repair).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      status: "invalid",
      code: null,
      message: "The model did not return a Mermaid diagram.",
    })
  })
})
