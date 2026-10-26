import { useEffect, useState } from "react"
import { getYouTubeTheme, watchYouTubeTheme, type YouTubeTheme } from "@/lib/youtube/theme"

export function useTheme(): YouTubeTheme {
  const [theme, setTheme] = useState<YouTubeTheme>(() => getYouTubeTheme())
  useEffect(() => {
    setTheme(getYouTubeTheme())
    return watchYouTubeTheme(setTheme)
  }, [])
  return theme
}
