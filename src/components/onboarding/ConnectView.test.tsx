import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import { chatgptSessionItem, settingsItem } from "@/lib/storage"

const setView = vi.hoisted(() => vi.fn())
const login = vi.hoisted(() => vi.fn(async () => ({ ok: true as const })))

vi.mock("@/components/shell/NavigationContext", () => ({
  usePanelNav: () => ({ setView }),
}))

vi.mock("@/components/shell/ToastContext", () => ({
  useToast: () => () => {},
}))

vi.mock("@/lib/chatgpt/client", () => ({
  requestChatGptLogin: () => login(),
  requestChatGptLogout: vi.fn(async () => {}),
}))

import { ConnectView } from "./ConnectView"

function button(root: HTMLElement, text: string): HTMLButtonElement {
  const found = [...root.querySelectorAll("button")].find((el) => el.textContent?.includes(text))
  if (!found) throw new Error(`missing button: ${text}`)
  return found
}

describe("ConnectView ChatGPT", () => {
  let el: HTMLDivElement
  let root: Root

  beforeEach(async () => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    fakeBrowser.reset()
    setView.mockClear()
    login.mockClear()
    login.mockResolvedValue({ ok: true })
    await chatgptSessionItem.setValue({ signedIn: false, message: "" })
    el = document.createElement("div")
    document.body.appendChild(el)
    root = createRoot(el)
  })

  async function mount(provider: "openai" | "chatgpt" = "openai") {
    await act(async () => root.render(<ConnectView initialProvider={provider} />))
    await act(async () => {})
  }

  async function selectChatGpt() {
    await act(async () => {
      button(el, "ChatGPT (subscription)").click()
    })
  }

  it("sets the provider and leaves onboarding after a successful login", async () => {
    await mount()
    await selectChatGpt()
    expect(el.textContent).not.toContain("Dùng ChatGPT")
    await act(async () => {
      button(el, "Đăng nhập ChatGPT").click()
    })
    await vi.waitFor(async () => {
      expect((await settingsItem.getValue()).provider).toBe("chatgpt")
    })
    expect(login).toHaveBeenCalledOnce()
    expect(setView).toHaveBeenCalledWith("main")
  })

  it("continues with ChatGPT when the account is already signed in", async () => {
    await chatgptSessionItem.setValue({ signedIn: true, message: "" })
    await mount()
    expect(el.textContent).not.toContain("Dùng ChatGPT")
    await selectChatGpt()
    await vi.waitFor(() => expect(el.textContent).toContain("Dùng ChatGPT"))
    await act(async () => {
      button(el, "Dùng ChatGPT").click()
    })
    await vi.waitFor(async () => {
      expect((await settingsItem.getValue()).provider).toBe("chatgpt")
    })
    expect(login).not.toHaveBeenCalled()
    expect(setView).toHaveBeenCalledWith("main")
  })
})
