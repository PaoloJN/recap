import { normalizeProOrigin } from "./origin"

/** The Recap Pro server origin baked in at build time, or null when this build is BYOK-only. */
export const PRO_ORIGIN: string | null = normalizeProOrigin(import.meta.env.WXT_PRO_ORIGIN)

export const PRO_ENABLED = PRO_ORIGIN !== null

/** Absolute URL for a Pro API path. Throws in a build without Recap Pro. */
export function proUrl(path: string): string {
  if (PRO_ORIGIN === null) throw new Error("Recap Pro is not enabled in this build")
  return `${PRO_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`
}
