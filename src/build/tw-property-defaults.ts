/**
 * PostCSS plugin: Tailwind v4 registers its `--tw-*` variables with `@property` so they have
 * initial values (`--tw-border-style: solid`, `--tw-shadow: 0 0 #0000`, ...). Chrome ignores
 * `@property` rules inside a shadow root's stylesheet, and Tailwind's own `@supports` fallback
 * only targets Safari/Firefox, so in our shadow-root UI those variables would be unset and
 * `border`, `shadow-*`, `translate-*` and `ring-*` utilities would break. This appends one rule
 * that sets every registered default on the shadow tree, in the lowest-priority `properties`
 * layer so any utility still overrides it.
 */

export interface PropertyDefault {
  name: string
  value: string
}

export const DEFAULTS_SELECTOR = ":host, :host *, :host ::before, :host ::after, :host ::backdrop"

/** The CSS for the defaults rule, or null when nothing has a usable initial value. */
export function propertyDefaultsCss(defaults: PropertyDefault[]): string | null {
  const usable = defaults.filter(({ value }) => value !== "" && value !== "initial")
  if (usable.length === 0) return null
  const decls = usable.map(({ name, value }) => `${name}: ${value};`).join(" ")
  return `@layer properties { ${DEFAULTS_SELECTOR} { ${decls} } }`
}

// Structural subset of the PostCSS API, so this module needs no direct `postcss` dependency.
interface DeclLike {
  prop: string
  value: string
}
interface AtRuleLike {
  params: string
  walkDecls(cb: (decl: DeclLike) => void): void
}
export interface RootLike {
  walkAtRules(name: string, cb: (rule: AtRuleLike) => void): void
  append(css: string): void
}

export function collectPropertyDefaults(root: RootLike): PropertyDefault[] {
  const byName = new Map<string, string>()
  root.walkAtRules("property", (rule) => {
    const name = rule.params.trim()
    if (!name.startsWith("--tw-")) return
    let value = ""
    rule.walkDecls((decl) => {
      if (decl.prop === "initial-value") value = decl.value.trim()
    })
    byName.set(name, value)
  })
  return [...byName].map(([name, value]) => ({ name, value }))
}

export const twPropertyDefaults = {
  postcssPlugin: "tw-property-defaults",
  OnceExit(root: RootLike) {
    const css = propertyDefaultsCss(collectPropertyDefaults(root))
    if (css) root.append(css)
  },
}
