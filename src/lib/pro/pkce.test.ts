import { describe, expect, it } from "vitest"
import { challengeFor, createPkce } from "./pkce"

const BASE64URL = /^[A-Za-z0-9_-]+$/

describe("challengeFor", () => {
  it("matches the RFC 7636 appendix B example", async () => {
    expect(await challengeFor("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    )
  })
})

describe("createPkce", () => {
  it("makes a 43-char base64url verifier and its challenge", async () => {
    const { verifier, challenge } = await createPkce()
    expect(verifier).toHaveLength(43)
    expect(verifier).toMatch(BASE64URL)
    expect(challenge).toHaveLength(43)
    expect(challenge).toMatch(BASE64URL)
    expect(challenge).toBe(await challengeFor(verifier))
  })

  it("makes a fresh verifier each time", async () => {
    const a = await createPkce()
    const b = await createPkce()
    expect(a.verifier).not.toBe(b.verifier)
  })
})
