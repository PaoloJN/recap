import { useEffect, useState } from "react"
import { createTrailingThrottle } from "@/lib/throttle"
import { onPlayerState, type PlayerState } from "@/lib/youtube/player"

const THROTTLE_MS = 250

export function usePlayer(): PlayerState {
  const [state, setState] = useState<PlayerState>({ ms: 0, paused: true })

  useEffect(() => {
    let paused = true
    const throttled = createTrailingThrottle((ms: number) => {
      setState((s) => (s.ms === ms ? s : { ms, paused: s.paused }))
    }, THROTTLE_MS)
    const off = onPlayerState((next) => {
      if (next.paused !== paused) {
        paused = next.paused
        throttled.cancel()
        setState({ ms: next.ms, paused })
        return
      }
      throttled(next.ms)
    })
    return () => {
      off()
      throttled.cancel()
    }
  }, [])

  return state
}
