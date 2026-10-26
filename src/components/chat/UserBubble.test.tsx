import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { UserBubble } from "./UserBubble"

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

describe("UserBubble", () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it("shows the quoted line's time and the asked-at stamp", () => {
    act(() =>
      root.render(
        <UserBubble text="What does this mean?" at={108} quote={{ seconds: 14, text: "A line" }} />,
      ),
    )
    const text = container.textContent ?? ""
    expect(text).toContain("0:14")
    expect(text).toContain("A line")
    expect(text).toContain("at 1:48")
    expect(text).toContain("What does this mean?")
  })

  it("renders only the bubble without a quote or stamp", () => {
    act(() => root.render(<UserBubble text="Hi" />))
    expect(container.textContent).toBe("Hi")
  })
})
