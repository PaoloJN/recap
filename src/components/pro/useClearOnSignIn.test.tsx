import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ProErrorCode } from "@/lib/pro/types"
import { useClearOnSignIn } from "./useClearOnSignIn"

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

const clear = vi.fn()
let root: Root

function Probe({ signedIn, code }: { signedIn: boolean; code: ProErrorCode | null }) {
  useClearOnSignIn(signedIn, code, clear)
  return null
}

const render = (signedIn: boolean, code: ProErrorCode | null) =>
  act(async () => root.render(<Probe signedIn={signedIn} code={code} />))

describe("useClearOnSignIn", () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    clear.mockClear()
    root = createRoot(document.createElement("div"))
  })
  afterEach(() => act(() => root.unmount()))

  it("clears an unauthorized error when signing in again", async () => {
    await render(true, null)
    await render(false, "unauthorized")
    expect(clear).not.toHaveBeenCalled()
    await render(true, "unauthorized")
    expect(clear).toHaveBeenCalledTimes(1)
  })

  it("leaves other errors alone", async () => {
    await render(false, "upgrade_required")
    await render(true, "upgrade_required")
    expect(clear).not.toHaveBeenCalled()
  })

  it("does nothing without a sign-in transition", async () => {
    await render(true, null)
    await render(true, "unauthorized")
    await render(true, "unauthorized")
    expect(clear).not.toHaveBeenCalled()
  })
})
