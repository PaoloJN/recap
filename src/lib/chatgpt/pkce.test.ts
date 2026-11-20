import { describe, expect, it } from "vitest"
import { createPkcePair, toBase64Url } from "./pkce"

describe("createPkcePair", () => {
  it("builds an S256 challenge from the verifier", async () => {
    const bytes = new Uint8Array(32).fill(7)
    const pair = await createPkcePair(() => bytes)
    expect(pair.verifier).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(pair.verifier).not.toMatch(/[+/=]/)
    expect(pair.challenge).not.toMatch(/[+/=]/)
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pair.verifier))
    expect(pair.challenge).toBe(toBase64Url(new Uint8Array(digest)))
    expect(pair.challenge).not.toBe(pair.verifier)
  })

  it("uses fresh entropy for each pair", async () => {
    const a = await createPkcePair()
    const b = await createPkcePair()
    expect(a.verifier).not.toBe(b.verifier)
    expect(a.challenge).not.toBe(b.challenge)
  })
})
