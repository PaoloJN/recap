import { useEffect, useState } from "react"
import { onTimeUpdate } from "@/lib/youtube/player"

const THROTTLE_MS = 250

export function usePlaybackMs(): number {
  const [ms, setMs] = useState(0)

  useEffect(() => {
    let last = Number.NEGATIVE_INFINITY
    return onTimeUpdate((value) => {
      const now = performance.now()
      if (now - last < THROTTLE_MS) return
      last = now
      setMs(value)
    })
  }, [])

  return ms
}
