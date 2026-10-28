import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ProErrorCode } from "@/lib/pro/types"
import { useRefreshOnGateError } from "./useRefreshOnGateError"

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

const refresh = vi.fn(async () => {})
let root: Root

function Probe({ error, code }: { error: unknown; code: ProErrorCode | null }) {
  useRefreshOnGateError(error, code, refresh)
  return null
}

const render = (error: unknown, code: ProErrorCode | null) =>
  act(async () => root.render(<Probe error={error} code={code} />))

describe("useRefreshOnGateError", () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    refresh.mockClear()
    root = createRoot(document.createElement("div"))
  })
  afterEach(() => act(() => root.unmount()))

  it.each(["upgrade_required", "limit_reached", "unauthorized"] as const)(
    "refreshes once on %s",
    async (code) => {
      const err = new Error("x")
      await render(err, code)
      await render(err, code)
      expect(refresh).toHaveBeenCalledTimes(1)
      await render(new Error("again"), code)
      expect(refresh).toHaveBeenCalledTimes(2)
    },
  )

  it("ignores inline errors and no error", async () => {
    await render(null, null)
    await render(new Error("x"), "rate_limited")
    await render(new Error("y"), null)
    expect(refresh).not.toHaveBeenCalled()
  })
})
