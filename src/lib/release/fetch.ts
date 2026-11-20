export const LATEST_RELEASE_URL = "https://api.github.com/repos/tungdd97/recap/releases/latest"

interface ReleaseAsset {
  name?: string
  browser_download_url?: string
}

interface LatestRelease {
  assets?: ReleaseAsset[]
}

interface VersionFile {
  version?: unknown
}

export async function fetchLatestReleaseVersion(
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const release = await fetchImpl(LATEST_RELEASE_URL, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "recap",
    },
  })
  if (!release.ok) return null
  const body = (await release.json()) as LatestRelease
  const asset = body.assets?.find((item) => item.name === "version.json")
  const url = asset?.browser_download_url
  if (!url) return null
  const file = await fetchImpl(url)
  if (!file.ok) return null
  const json = (await file.json()) as VersionFile
  return typeof json.version === "string" && json.version.length > 0 ? json.version : null
}
