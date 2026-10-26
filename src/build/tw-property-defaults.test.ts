import { describe, expect, it } from "vitest"
import {
  collectPropertyDefaults,
  DEFAULTS_SELECTOR,
  propertyDefaultsCss,
  type RootLike,
  twPropertyDefaults,
} from "./tw-property-defaults"

// `postcss` is not a direct dependency (pnpm keeps it nested), so the plugin is exercised on a
// minimal stand-in that implements the two Root methods it uses.
function fakeRoot(properties: Record<string, string | undefined>) {
  const appended: string[] = []
  const root: RootLike = {
    walkAtRules(name, cb) {
      if (name !== "property") return
      for (const [prop, initial] of Object.entries(properties)) {
        cb({
          params: prop,
          walkDecls(each) {
            each({ prop: "syntax", value: '"*"' })
            each({ prop: "inherits", value: "false" })
            if (initial !== undefined) each({ prop: "initial-value", value: initial })
          },
        })
      }
    },
    append(css) {
      appended.push(css)
    },
  }
  return { root, appended }
}

describe("tw-property-defaults", () => {
  it("collects --tw-* initial values and ignores other properties", () => {
    const { root } = fakeRoot({
      "--tw-border-style": "solid",
      "--tw-shadow-color": undefined,
      "--other": "1px",
    })
    expect(collectPropertyDefaults(root)).toEqual([
      { name: "--tw-border-style", value: "solid" },
      { name: "--tw-shadow-color", value: "" },
    ])
  })

  it("builds one layered :host rule, skipping empty and initial values", () => {
    const css = propertyDefaultsCss([
      { name: "--tw-border-style", value: "solid" },
      { name: "--tw-shadow", value: "0 0 #0000" },
      { name: "--tw-leading", value: "" },
      { name: "--tw-rotate-x", value: "initial" },
    ])
    expect(css).toBe(
      `@layer properties { ${DEFAULTS_SELECTOR} { --tw-border-style: solid; --tw-shadow: 0 0 #0000; } }`,
    )
    expect(propertyDefaultsCss([{ name: "--tw-leading", value: "" }])).toBeNull()
  })

  it("appends the rule at OnceExit, and nothing without @property rules", () => {
    const withProps = fakeRoot({ "--tw-translate-x": "0", "--tw-border-style": "solid" })
    twPropertyDefaults.OnceExit(withProps.root)
    expect(withProps.appended).toHaveLength(1)
    expect(withProps.appended[0]).toContain("--tw-translate-x: 0;")
    expect(withProps.appended[0]).toContain(":host *")

    const empty = fakeRoot({})
    twPropertyDefaults.OnceExit(empty.root)
    expect(empty.appended).toEqual([])
  })
})
