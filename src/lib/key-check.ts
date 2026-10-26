import { browser } from "wxt/browser"
import type { KeyCheckRequest, KeyCheckResult } from "./port-protocol"
import type { ProviderId } from "./types"

export async function checkKey(provider: ProviderId, key: string): Promise<KeyCheckResult> {
  const request: KeyCheckRequest = { type: "validate-key", provider, key }
  return (await browser.runtime.sendMessage(request)) as KeyCheckResult
}
