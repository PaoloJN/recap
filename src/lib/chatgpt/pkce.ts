export function toBase64Url(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function randomBytes(size: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(size))
}

/** PKCE S256. The verifier is high-entropy base64url; the challenge is its SHA-256. */
export async function createPkcePair(
  bytes: (size: number) => Uint8Array = randomBytes,
): Promise<{ verifier: string; challenge: string }> {
  const verifier = toBase64Url(bytes(32))
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
  return { verifier, challenge: toBase64Url(new Uint8Array(digest)) }
}

export function randomUrlToken(bytes: (size: number) => Uint8Array = randomBytes): string {
  return toBase64Url(bytes(32))
}
