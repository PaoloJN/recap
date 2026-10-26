export const TRANSCRIPT_PANEL_ID = "PAmodern_transcript_view"

// Protobuf field 149 (tag aa 09, length-delimited) wrapping { 1: videoId, 3: 2 }.
// Single-byte lengths are fine: video ids are 11 chars.
export function encodePanelParams(videoId: string): string {
  const id = new TextEncoder().encode(videoId)
  const inner = [0x0a, id.length, ...id, 0x18, 0x02]
  return btoa(String.fromCharCode(0xaa, 0x09, inner.length, ...inner))
}
