import { beforeEach, vi } from "vitest"

// Tests run as a build without Recap Pro, whatever a developer's .env says. A test that needs
// Pro opts in with `vi.stubEnv("WXT_PRO_ORIGIN", …)` + `vi.resetModules()` before importing
// `@/lib/pro/config`, or mocks that module. Re-stubbed before each test because
// `vi.unstubAllEnvs()` restores the real value.
vi.stubEnv("WXT_PRO_ORIGIN", "")
beforeEach(() => {
  vi.stubEnv("WXT_PRO_ORIGIN", "")
})
