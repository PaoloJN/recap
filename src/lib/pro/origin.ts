/**
 * Normalises the `WXT_PRO_ORIGIN` build option. Shared by `wxt.config.ts` (manifest) and
 * `config.ts` (app code) so both agree. Unset or blank → null (Pro disabled); otherwise it
 * must be a bare http(s) origin, e.g. `https://recapai.dev` (a trailing "/" is fine).
 */
export function normalizeProOrigin(raw: string | undefined): string | null {
  const value = raw?.trim().replace(/\/+$/, "") ?? ""
  if (value === "") return null
  const fail = (): never => {
    throw new Error(
      `WXT_PRO_ORIGIN must be an http(s) origin like "https://recapai.dev", got "${raw}"`,
    )
  }
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return fail()
  }
  const bare = url.pathname === "/" && !url.search && !url.hash && !url.username && !url.password
  if ((url.protocol !== "http:" && url.protocol !== "https:") || !bare) fail()
  return url.origin
}
