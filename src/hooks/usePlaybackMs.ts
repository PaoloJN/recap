import { useEffect, useState } from "react"
import { createTrailingThrottle } from "@/lib/throttle"
import { onTimeUpdate } from "@/lib/youtube/player"

const THROTTLE_MS = 250

export function usePlaybackMs(): number {
  const [ms, setMs] = useState(0)

  useEffect(() => {
    const throttled = createTrailingThrottle(setMs, THROTTLE_MS)
    const off = onTimeUpdate(throttled)
    return () => {
      off()
      throttled.cancel()
    }
  }, [])

  return ms
}
