import { usePlayer } from "./usePlayer"

/** Thin wrapper kept until the old UI is removed. */
export function usePlaybackMs(): number {
  return usePlayer().ms
}
