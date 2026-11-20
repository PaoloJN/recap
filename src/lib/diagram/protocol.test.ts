import { describe, expect, it } from "vitest"
import { isDiagramPing, isDiagramReady, webPageOrigin } from "./protocol"

describe("diagram handshake", () => {
  it("accepts a web page origin and rejects an extension url or an empty referrer", () => {
    expect(webPageOrigin("https://www.youtube.com/watch?v=abc")).toBe("https://www.youtube.com")
    expect(webPageOrigin("http://127.0.0.1:8080/lesson")).toBe("http://127.0.0.1:8080")
    expect(webPageOrigin("")).toBeNull()
    expect(webPageOrigin("chrome-extension://abcdefghijklmnop/diagram-renderer.html")).toBeNull()
  })

  it("recognizes the ping that replaces a stripped referrer", () => {
    expect(isDiagramPing({ source: "recap-diagram", type: "ping" })).toBe(true)
    expect(isDiagramPing({ source: "recap-diagram", type: "ready" })).toBe(false)
    expect(isDiagramReady({ source: "recap-diagram", type: "ready" })).toBe(true)
  })
})
