import { describe, expect, it } from "vitest"
import { encodePanelParams, TRANSCRIPT_PANEL_ID } from "./params"

describe("encodePanelParams", () => {
  it("encodes protobuf field 149 { 1: videoId, 3: 2 }", () => {
    const out = encodePanelParams("pcD9vh1jtBE")
    expect(out).toHaveLength(24)
    const bytes = Array.from(atob(out), (c) => c.charCodeAt(0))
    const id = Array.from(new TextEncoder().encode("pcD9vh1jtBE"))
    expect(bytes).toEqual([0xaa, 0x09, 0x0f, 0x0a, 0x0b, ...id, 0x18, 0x02])
    expect(bytes).toHaveLength(18)
  })

  it("exposes the panel id", () => {
    expect(TRANSCRIPT_PANEL_ID).toBe("PAmodern_transcript_view")
  })
})
