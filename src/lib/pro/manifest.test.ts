import { describe, expect, it } from "vitest"
import { proManifestAdditions } from "./manifest"

describe("proManifestAdditions", () => {
  it("adds nothing without a Pro origin", () => {
    expect(proManifestAdditions(null)).toEqual({ permissions: [] })
  })
  it("adds no permissions and no host access for a Pro origin", () => {
    expect(proManifestAdditions("https://recapai.dev")).toEqual({ permissions: [] })
    expect(proManifestAdditions("http://localhost:3000")).not.toHaveProperty("host_permissions")
  })
})
