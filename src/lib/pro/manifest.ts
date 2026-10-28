/**
 * Manifest entries a Recap Pro build adds: `identity` for Google sign-in through
 * `launchWebAuthFlow`, and host access to the Pro origin. `origin` is the normalised
 * `WXT_PRO_ORIGIN` (see `origin.ts`); null means a bring-your-own-key build, which adds nothing.
 */
export function proManifestAdditions(origin: string | null): {
  permissions: string[]
  host_permissions: string[]
} {
  if (!origin) return { permissions: [], host_permissions: [] }
  return { permissions: ["identity"], host_permissions: [`${origin}/*`] }
}
