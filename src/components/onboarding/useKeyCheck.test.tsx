import { act } from "react"
import { createRoot } from "react-dom/client"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { KeyCheckResult } from "@/lib/port-protocol"
import type { ProviderId } from "@/lib/types"
import { type KeyCheckState, useKeyCheck } from "./useKeyCheck"

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

let state: KeyCheckState
let stub: (p: ProviderId, k: string) => Promise<KeyCheckResult>

function Probe() {
  state = useKeyCheck(stub)
  return null
}

describe("useKeyCheck", () => {
  beforeEach(async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    stub = vi.fn()
    await act(async () => createRoot(document.createElement("div")).render(<Probe />))
  })

  it("flags an empty key without calling", async () => {
    await act(() => state.check("openai", "  "))
    expect(state.error).toBe(true)
    expect(state.status).toBe("idle")
    expect(stub).not.toHaveBeenCalled()
  })

  it("maps a rejection to invalid", async () => {
    stub = vi.fn(async () => ({ ok: false as const, status: 401, message: "nope" }))
    await act(async () => createRoot(document.createElement("div")).render(<Probe />))
    await act(() => state.check("openai", "sk-x"))
    expect(state.status).toBe("invalid")
    expect(state.result).toEqual({ ok: false, status: 401, message: "nope" })
  })

  it("maps success to valid and reset returns to idle", async () => {
    stub = vi.fn(async () => ({ ok: true as const, models: ["a"] }))
    await act(async () => createRoot(document.createElement("div")).render(<Probe />))
    await act(() => state.check("openai", "sk-x"))
    expect(state.status).toBe("valid")
    act(() => state.reset())
    expect(state.status).toBe("idle")
    expect(state.result).toBeNull()
  })
})
