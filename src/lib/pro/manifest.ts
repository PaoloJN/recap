/**
 * Manifest entries a Recap Pro build adds: none. Sign-in runs in a normal tab and hands the key
 * over through `/api/v1/link`, and `tabs.create`/`update`/`remove` and `windows.update` need no
 * permission (the background never reads tab URLs). There is deliberately no host permission for
 * the Pro origin either: adding one is a privilege increase that makes Chrome disable the
 * extension for existing users on update, and it isn't needed because the Pro server answers
 * every `/api/v1/*` request with `access-control-allow-origin: *` (no credentials). `origin` is
 * the normalised `WXT_PRO_ORIGIN` (see `origin.ts`); null means a bring-your-own-key build.
 */
export function proManifestAdditions(_origin: string | null): { permissions: string[] } {
  return { permissions: [] }
}
