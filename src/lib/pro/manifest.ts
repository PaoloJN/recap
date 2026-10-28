/**
 * Manifest entries a Recap Pro build adds: only `identity`, for Google sign-in through
 * `launchWebAuthFlow`. There is deliberately no host permission for the Pro origin: adding one
 * is a privilege increase that makes Chrome disable the extension for existing users on update,
 * and it isn't needed because the Pro server answers every `/api/v1/*` request with
 * `access-control-allow-origin: *` (GET/POST, `x-api-key` and `content-type` headers, no
 * credentials). `origin` is the normalised `WXT_PRO_ORIGIN` (see `origin.ts`); null means a
 * bring-your-own-key build, which adds nothing.
 */
export function proManifestAdditions(origin: string | null): { permissions: string[] } {
  if (!origin) return { permissions: [] }
  return { permissions: ["identity"] }
}
