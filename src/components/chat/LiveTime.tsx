import { usePlayer } from "@/hooks/usePlayer"
import { formatMs } from "@/lib/timestamps"

/** The current playback time as m:ss. Subscribes to the player so its parent doesn't have to. */
export function LiveTime() {
  return <>{formatMs(usePlayer().ms)}</>
}
