import { browser } from "wxt/browser"
import type { KeyCheckRequest, KeyCheckResult } from "./port-protocol"
import type { ByokProviderId } from "./types"

export async function checkKey(provider: ByokProviderId, key: string): Promise<KeyCheckResult> {
  const request: KeyCheckRequest = { type: "validate-key", provider, key }
  const result = (await browser.runtime.sendMessage(request)) as KeyCheckResult | undefined
  return (
    result ?? { ok: false, status: null, message: "No response from the extension. Try again." }
  )
}
