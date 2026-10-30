/** PKCE-style secret for the sign-in link (RFC 7636 S256): only the challenge leaves the device. */

function base64url(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/** base64url(SHA-256(verifier as ASCII)), unpadded. */
export async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
  return base64url(new Uint8Array(digest))
}

/** A 43-char verifier (32 random bytes) and its challenge. */
export async function createPkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)))
  return { verifier, challenge: await challengeFor(verifier) }
}
