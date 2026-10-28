import { describe, expect, it } from "vitest"
import { proManifestAdditions } from "./manifest"

describe("proManifestAdditions", () => {
  it("adds nothing without a Pro origin", () => {
    expect(proManifestAdditions(null)).toEqual({ permissions: [], host_permissions: [] })
  })
  it("adds identity and host access to the Pro origin", () => {
    expect(proManifestAdditions("https://recapai.dev")).toEqual({
      permissions: ["identity"],
      host_permissions: ["https://recapai.dev/*"],
    })
    expect(proManifestAdditions("http://localhost:3000").host_permissions).toEqual([
      "http://localhost:3000/*",
    ])
  })
})
