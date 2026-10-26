import { useCallback } from "react"
import { useToast } from "@/components/shell/ToastContext"
import { formatMs } from "@/lib/timestamps"
import { seekTo } from "@/lib/youtube/player"

/** Seeks the player and confirms with a "Jumped to mm:ss" toast. */
export function useSeek(): (seconds: number) => void {
  const toast = useToast()
  return useCallback(
    (seconds: number) => {
      seekTo(seconds)
      toast(`Jumped to ${formatMs(seconds * 1000)}`)
    },
    [toast],
  )
}
