import { afterEach, describe, expect, it, vi } from "vitest"
import { normalizeProOrigin } from "./origin"

describe("normalizeProOrigin", () => {
  it("treats unset or blank as disabled", () => {
    expect(normalizeProOrigin(undefined)).toBeNull()
    expect(normalizeProOrigin("")).toBeNull()
    expect(normalizeProOrigin("   ")).toBeNull()
  })
  it("trims and strips a trailing slash", () => {
    expect(normalizeProOrigin(" https://recapai.dev/ ")).toBe("https://recapai.dev")
    expect(normalizeProOrigin("http://localhost:3000")).toBe("http://localhost:3000")
  })
  it("rejects non-http(s) values and paths", () => {
    expect(() => normalizeProOrigin("recapai.dev")).toThrow(/WXT_PRO_ORIGIN/)
    expect(() => normalizeProOrigin("ftp://recapai.dev")).toThrow(/WXT_PRO_ORIGIN/)
    expect(() => normalizeProOrigin("https://recapai.dev/api")).toThrow(/WXT_PRO_ORIGIN/)
  })
})

// config.ts reads import.meta.env at module load, so each case stubs the env and re-imports it.
async function loadConfig(origin: string) {
  vi.resetModules()
  vi.stubEnv("WXT_PRO_ORIGIN", origin)
  return import("./config")
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("config", () => {
  it("is enabled with a normalised origin when WXT_PRO_ORIGIN is set", async () => {
    const config = await loadConfig("https://recapai.dev/")
    expect(config.PRO_ENABLED).toBe(true)
    expect(config.PRO_ORIGIN).toBe("https://recapai.dev")
  })
  it("proUrl joins without a double slash", async () => {
    const { proUrl } = await loadConfig("https://recapai.dev/")
    expect(proUrl("/api/v1/me")).toBe("https://recapai.dev/api/v1/me")
    expect(proUrl("api/v1/me")).toBe("https://recapai.dev/api/v1/me")
  })
  it("is disabled and proUrl throws when WXT_PRO_ORIGIN is empty", async () => {
    const config = await loadConfig("")
    expect(config.PRO_ENABLED).toBe(false)
    expect(config.PRO_ORIGIN).toBeNull()
    expect(() => config.proUrl("/api/v1/me")).toThrow()
  })
})
