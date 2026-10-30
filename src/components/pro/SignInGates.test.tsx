import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AccessGate } from "./AccessGate"
import { SignedOutGate } from "./SignedOutGate"

const mocks = vi.hoisted(() => ({
  linkPending: false,
  signIn: vi.fn(async () => {}),
  reopenSignIn: vi.fn(async () => {}),
  cancelSignIn: vi.fn(async () => {}),
}))

vi.mock("@/hooks/usePro", () => ({
  usePro: () => ({
    linkPending: mocks.linkPending,
    reopenSignIn: mocks.reopenSignIn,
    cancelSignIn: mocks.cancelSignIn,
  }),
}))
vi.mock("@/hooks/usePricing", () => ({ usePricing: () => null }))
vi.mock("./useProSignIn", () => ({
  useProSignIn: () => ({ signIn: mocks.signIn, signingIn: false }),
}))
vi.mock("@/components/shell/NavigationContext", () => ({
  usePanelNav: () => ({ setView: vi.fn(), selectTab: vi.fn() }),
}))

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

let root: Root
let el: HTMLDivElement

function labels(): string[] {
  return [...el.querySelectorAll("button")].map((b) => b.textContent ?? "")
}

function button(label: string): HTMLButtonElement {
  const found = [...el.querySelectorAll("button")].find((b) => b.textContent === label)
  if (!found) throw new Error(`no button ${label}`)
  return found
}

describe.each([
  ["AccessGate", () => <AccessGate verb="summarize videos" />, "Sign in"],
  ["SignedOutGate", () => <SignedOutGate />, "Sign in again"],
])("%s", (_name, gate, signInLabel) => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    mocks.linkPending = false
    mocks.signIn.mockClear()
    mocks.reopenSignIn.mockClear()
    mocks.cancelSignIn.mockClear()
    el = document.createElement("div")
    root = createRoot(el)
  })

  afterEach(() => act(() => root.unmount()))

  it("signs in without a Google mark", async () => {
    await act(async () => root.render(gate()))
    await act(async () => button(signInLabel).click())
    expect(mocks.signIn).toHaveBeenCalledTimes(1)
    expect(el.querySelector("svg path[fill='#4285F4']")).toBeNull()
  })

  it("waits for the other tab while a sign-in is pending", async () => {
    mocks.linkPending = true
    await act(async () => root.render(gate()))
    expect(el.querySelector("h2")?.textContent).toBe("Finish signing in in the other tab")
    expect(el.textContent).toContain("Recap will pick it up as soon as you're done.")
    expect(labels()).toEqual(["Open it again", "Cancel"])
    await act(async () => button("Open it again").click())
    expect(mocks.reopenSignIn).toHaveBeenCalledTimes(1)
    await act(async () => button("Cancel").click())
    expect(mocks.cancelSignIn).toHaveBeenCalledTimes(1)
  })
})

describe("AccessGate copy", () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    mocks.linkPending = false
    el = document.createElement("div")
    root = createRoot(el)
  })

  afterEach(() => act(() => root.unmount()))

  it("keeps your own key and the transcript as ways out", async () => {
    await act(async () => root.render(<AccessGate verb="chat with videos" />))
    expect(labels()).toEqual(["Sign in", "Use my own key", "Open transcript"])
  })
})
