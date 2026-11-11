/** The Recap website. Marketing, account and the uninstall survey live here in every build. */
export const SITE_ORIGIN = "https://recapai.dev"

export const UNINSTALL_URL = `${SITE_ORIGIN}/uninstalled`

/**
 * Where to leave a review. Chrome's listing id is the extension id for store installs; Firefox
 * has no equivalent URL we can derive, so the prompt is Chrome-only.
 */
export function reviewUrl(extensionId: string, firefox: boolean): string | null {
  if (firefox) return null
  return `https://chromewebstore.google.com/detail/${extensionId}/reviews`
}
