import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ProLinkPollResult } from "@/lib/port-protocol"
import { LINK_POLL_MS, useLinkPoll } from "./useLinkPoll"

const mocks = vi.hoisted(() => ({
  results: [] as ProLinkPollResult["state"][],
  pollLink: vi.fn(),
  setView: vi.fn(),
  toast: vi.fn(),
  updateSettings: vi.fn(async (_patch: unknown) => {}),
}))

vi.mock("@/hooks/usePro", () => ({ usePro: () => ({ pollLink: mocks.pollLink }) }))
vi.mock("@/hooks/useSettings", () => ({ updateSettings: mocks.updateSettings }))
vi.mock("@/components/shell/NavigationContext", () => ({
  usePanelNav: () => ({ setView: mocks.setView }),
}))
vi.mock("@/components/shell/ToastContext", () => ({ useToast: () => mocks.toast }))

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

function Probe({ active }: { active: boolean }) {
  useLinkPoll(active)
  return null
}

let root: Root

const render = (active: boolean) => act(async () => root.render(<Probe active={active} />))

/** Advances one poll interval and lets the poll's reply settle. */
async function tick(times = 1) {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LINK_POLL_MS)
    })
  }
}

describe("useLinkPoll", () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    vi.useFakeTimers()
    mocks.results = []
    mocks.pollLink.mockReset()
    mocks.pollLink.mockImplementation(
      async (): Promise<ProLinkPollResult> => ({ state: mocks.results.shift() ?? "pending" }),
    )
    mocks.setView.mockClear()
    mocks.toast.mockClear()
    mocks.updateSettings.mockClear()
    root = createRoot(document.createElement("div"))
  })

  afterEach(() => {
    act(() => root.unmount())
    vi.useRealTimers()
  })

  it("polls every 1.5 s while active, and not at all while inactive", async () => {
    await render(false)
    await tick(3)
    expect(mocks.pollLink).not.toHaveBeenCalled()
    await render(true)
    expect(mocks.pollLink).not.toHaveBeenCalled()
    await tick()
    expect(mocks.pollLink).toHaveBeenCalledTimes(1)
    await tick(2)
    expect(mocks.pollLink).toHaveBeenCalledTimes(3)
  })

  it("switches to Recap Pro on signed-in, keeps polling until done, and toasts once", async () => {
    mocks.results = ["pending", "signed-in", "signed-in", "done"]
    await render(true)
    await tick(2)
    expect(mocks.updateSettings).toHaveBeenCalledWith({ provider: "pro" })
    expect(mocks.setView).toHaveBeenCalledWith("main")
    expect(mocks.toast).toHaveBeenCalledWith("Signed in to Recap Pro")
    await tick(2)
    expect(mocks.pollLink).toHaveBeenCalledTimes(4)
    await tick(3)
    expect(mocks.pollLink).toHaveBeenCalledTimes(4)
    expect(mocks.updateSettings).toHaveBeenCalledTimes(1)
    expect(mocks.toast).toHaveBeenCalledTimes(1)
  })

  it("switches to Recap Pro when done arrives without signed-in first", async () => {
    mocks.results = ["done"]
    await render(true)
    await tick(3)
    expect(mocks.pollLink).toHaveBeenCalledTimes(1)
    expect(mocks.updateSettings).toHaveBeenCalledWith({ provider: "pro" })
    expect(mocks.setView).toHaveBeenCalledWith("main")
    expect(mocks.toast).toHaveBeenCalledTimes(1)
    expect(mocks.toast).toHaveBeenCalledWith("Signed in to Recap Pro")
  })

  it("stops and says so when the link expired", async () => {
    mocks.results = ["pending", "expired"]
    await render(true)
    await tick(4)
    expect(mocks.pollLink).toHaveBeenCalledTimes(2)
    expect(mocks.toast).toHaveBeenCalledTimes(1)
    expect(mocks.toast).toHaveBeenCalledWith("Sign-in timed out. Try again.")
    expect(mocks.updateSettings).not.toHaveBeenCalled()
  })

  it("stops quietly when there is no flow", async () => {
    mocks.results = ["idle"]
    await render(true)
    await tick(3)
    expect(mocks.pollLink).toHaveBeenCalledTimes(1)
    expect(mocks.toast).not.toHaveBeenCalled()
  })

  it("keeps polling through errors", async () => {
    mocks.results = ["error", "error", "pending", "error"]
    await render(true)
    await tick(5)
    expect(mocks.pollLink).toHaveBeenCalledTimes(5)
    expect(mocks.toast).not.toHaveBeenCalled()
  })

  it("never sends a poll while the previous one is unanswered", async () => {
    let answer: (r: ProLinkPollResult) => void = () => {}
    mocks.pollLink.mockImplementationOnce(
      () =>
        new Promise<ProLinkPollResult>((resolve) => {
          answer = resolve
        }),
    )
    await render(true)
    await tick(3)
    expect(mocks.pollLink).toHaveBeenCalledTimes(1)
    await act(async () => answer({ state: "pending" }))
    await tick()
    expect(mocks.pollLink).toHaveBeenCalledTimes(2)
  })

  it("stops when it goes inactive or unmounts", async () => {
    await render(true)
    await tick()
    await render(false)
    await tick(3)
    expect(mocks.pollLink).toHaveBeenCalledTimes(1)
    await render(true)
    await tick()
    expect(mocks.pollLink).toHaveBeenCalledTimes(2)
    act(() => root.unmount())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LINK_POLL_MS * 3)
    })
    expect(mocks.pollLink).toHaveBeenCalledTimes(2)
    root = createRoot(document.createElement("div"))
  })

  it("toasts again for a later sign-in", async () => {
    mocks.results = ["done"]
    await render(true)
    await tick()
    await render(false)
    mocks.results = ["signed-in", "done"]
    await render(true)
    await tick(2)
    expect(mocks.toast).toHaveBeenCalledTimes(2)
  })
})
