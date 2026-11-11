# Recap Pro Extension Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Recap Pro client to the public extension: a "Recap Pro" provider that signs in with Google, streams through recapai.dev, and shows trial, upgrade, limit and account states, while BYOK keeps working unchanged.

**Architecture:** Pro is a build-time option (`WXT_PRO_ORIGIN`). When unset the build is today's BYOK extension byte-for-byte in behaviour. When set, `"pro"` becomes a provider: the background owns sign-in (`identity.launchWebAuthFlow`), the device token, `/api/v1` calls and SSE parsing, and forwards UI message chunks over the existing port protocol, now with an error `code`. The panel reads a `local:pro` snapshot and shows gates per error code.

**Tech Stack:** WXT 0.21, React 19, TypeScript strict, Tailwind v4, shadcn/radix, Phosphor icons, AI SDK 7 (`ai` UI message chunks), Vitest, Biome.

**Spec:** `docs/superpowers/specs/2026-10-27-recap-pro-design.md` (§ Extension changes, § API, § Sign-in handoff; the "Stream contract" bullet is binding).

## Global Constraints

- Work on branch `pro` off `main`. Never drive a browser; verify with `pnpm check && pnpm typecheck && pnpm test && pnpm build && pnpm build:firefox`, plus `WXT_PRO_ORIGIN=http://localhost:3000 pnpm build` for the Pro build.
- Pro build option: `import.meta.env.WXT_PRO_ORIGIN`; unset → no "pro" provider, no `identity` permission, no Pro host permission, default provider `openai`, onboarding starts at the key screen. Set → "pro" listed first and default for fresh installs.
- Existing installs keep their stored provider. `mergeSettings` accepts `"pro"` only when Pro is enabled; otherwise it falls back to the default.
- Server contract (from recap-website, binding): `POST {origin}/api/v1/stream` with `x-api-key`, body `{ kind: "summary"|"chat", system: string, messages: ModelMessage[] }` (roles user/assistant only; content string or `{type:"text",text}` parts); success is an SSE UI message stream; errors JSON `{ error, message, ...extra }`: 400 `bad_request`, 401 `unauthorized`, 402 `upgrade_required`, 413 `too_large`, 429 `limit_reached` (has `resetsAt`) or 429 `rate_limited`, 503 `model_unavailable`, 500 `internal_error`. After content starts, failure arrives as an SSE `error` chunk with `errorText: "model_unavailable"`. `GET /api/v1/me` → `MeResponse`; `POST /api/v1/disconnect` → 204; `GET /api/v1/pricing` → `{ monthly: { display }, yearly: { display } }` (public).
- `MeResponse = { user: { email, name, image }, plan: "trial"|"pro"|"expired", usage: { summaries, chats, summaryLimit, chatLimit, resetsAt: string|null }, subscription: { status, currentPeriodEnd: string|null, cancelAtPeriodEnd } | null }`.
- Server request limits: total text ≤ 160,000 chars, ≤ 40 messages. The extension trims the oldest chat turns (never the system prompt or the latest user message) to fit before sending.
- Sign-in URL: `{origin}/extension/connect?redirect_uri=<encodeURIComponent(browser.identity.getRedirectURL("connect"))>&browser=chrome|firefox`; success returns `<redirect>#token=<key>`. A closed window is "cancelled", not an error.
- Device keys only work on `/api/v1`; the extension never calls `/api/auth/*`.
- Copy never says "cloud". The tier is "Recap Pro"; the free path is "your own key". Match the v3 design language (`docs/design/v3-handoff/`, `components/summary/buttons.ts` button styles, `card`/`secondary` surfaces, Phosphor icons).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. A build without `WXT_PRO_ORIGIN` must behave exactly like today: no Pro row, no `identity` permission, NoKeyGate copy unchanged (Task 1 and Task 8 tests).
2. A 401 from any Pro call clears the stored token and shows the signed-out gate; it never loops sign-in automatically (Task 2, Task 5 tests).
3. An SSE `error` chunk after partial text keeps the partial answer visible and shows a retryable error, not a blank state (Task 4 tests).
4. Long chat history: a 45-message thread or one over 160,000 chars is trimmed client-side and still sends (Task 4 tests).
5. Upgrade polling stops when the plan turns `pro`, after 2 minutes, or when the tab is hidden, and never runs two pollers at once (Task 6 tests).

---

## File structure

```
src/lib/pro/config.ts            PRO_ORIGIN, PRO_ENABLED, proUrl(path)
src/lib/pro/types.ts             MeResponse, ProErrorCode, ProState, Pricing
src/lib/pro/api.ts               fetchMe, fetchPricing, disconnect, streamRequest (HTTP + error mapping)
src/lib/pro/sse.ts               readUiChunks(response) → AsyncIterable<UIMessageChunk>
src/lib/pro/trim.ts              trimForPro(system, messages) → messages
src/lib/pro/plan-copy.ts         planLine(me, now), usageLine(me)
src/background/pro-auth.ts       parseTokenFromRedirect, signIn, signOut, refresh, registerProHandlers
src/background/stream-handler.ts (modify) pro branch
src/hooks/usePro.ts              snapshot + actions + refresh policy
src/components/pro/*             WelcomeView, AccessGate, UpgradeGate, LimitGate, SignedOutGate, GoogleMark, AccountRows
```

---

### Task 1: Pro build option, provider id and storage

**Files:**
- Create: `src/lib/pro/config.ts`, `src/lib/pro/types.ts`, `.env.example`
- Modify: `src/lib/types.ts`, `src/lib/providers.ts`, `src/lib/storage.ts`, `wxt.config.ts`, `src/background/validate-key.ts`, `src/lib/key-check.ts` and any file whose types break (`ConnectView`, `KeyField`, `SettingsView`, `ModelPicker`, `SummaryActions`, `SummaryPanel`)
- Test: `src/lib/pro/config.test.ts`, `src/lib/storage.test.ts`, `src/lib/providers.test.ts`

**Interfaces:**
- Produces:
  - `ProviderId = "pro" | ByokProviderId`; `ByokProviderId = "openai" | "anthropic" | "google" | "openrouter"`.
  - `BYOK_PROVIDER_IDS: readonly ByokProviderId[]`; `PROVIDER_IDS: readonly ProviderId[]` = `PRO_ENABLED ? ["pro", ...BYOK] : BYOK`.
  - `PROVIDERS: Record<ProviderId, ProviderInfo>` with `pro: { id: "pro", label: "Recap Pro", models: [{ id: "pro", label: "Recap Pro", note: "No key needed" }], defaultModel: "pro", keyUrl: "", keyHint: "", tagline: "No key needed. Sign in and go", tag: "Recommended" }`.
  - `isByok(id: ProviderId): id is ByokProviderId`.
  - `createModel(selection, key)` accepts only BYOK selections (type-level) and throws for `"pro"`.
  - `ApiKeys = Partial<Record<ByokProviderId, string>>`; key-check types use `ByokProviderId`.
  - `config.ts`: `PRO_ORIGIN: string | null` (from `import.meta.env.WXT_PRO_ORIGIN`, trailing slash stripped, empty → null), `PRO_ENABLED = PRO_ORIGIN !== null`, `proUrl(path: string): string` (throws when disabled).
  - `types.ts`: `MeResponse` (Global Constraints), `ProErrorCode = "unauthorized" | "upgrade_required" | "too_large" | "limit_reached" | "rate_limited" | "model_unavailable" | "bad_request" | "network" | "internal_error"`, `Pricing = { monthly: { display: string }; yearly: { display: string } }`, `ProState = { token: string | null; me: MeResponse | null; fetchedAt: number }`.
  - `storage.ts`: `proItem = storage.defineItem<ProState>("local:pro", { fallback: { token: null, me: null, fetchedAt: 0 } })`; `DEFAULT_SETTINGS.provider = PRO_ENABLED ? "pro" : "openai"`; `models` keeps BYOK keys plus `pro: "pro"`.
- Manifest: when `WXT_PRO_ORIGIN` is set at build time, add permission `identity` and host permission `${origin}/*`; when unset, neither.

- [ ] **Step 1: Failing tests**: `mergeSettings({ provider: "pro" })` → `"pro"` when enabled and `"openai"` when disabled (test both by mocking `@/lib/pro/config`); `mergeSettings({ provider: "anthropic" })` keeps `"anthropic"` in both; `PROVIDER_IDS[0] === "pro"` only when enabled; `proUrl("/api/v1/me")` joins without a double slash; `createModel({ provider: "pro", model: "pro" }, "k")` throws.
- [ ] **Step 2: Run** → fail. **Step 3: Implement**; fix every type error the union change causes, keeping BYOK-only UI (key screen, key rows, key validation) on `BYOK_PROVIDER_IDS`. **Step 4: Run** all verification commands including the Pro build; inspect `.output/chrome-mv3/manifest.json` for both builds and note the permission difference in the report.
- [ ] **Step 5: Commit** `feat: Recap Pro build option and provider id`.

---

### Task 2: Pro HTTP client and SSE reader

**Files:**
- Create: `src/lib/pro/api.ts`, `src/lib/pro/sse.ts`, `src/lib/pro/trim.ts`
- Test: `src/lib/pro/api.test.ts`, `src/lib/pro/sse.test.ts`, `src/lib/pro/trim.test.ts`

**Interfaces:**
- Consumes: `proUrl`, `MeResponse`, `ProErrorCode`, `Pricing`.
- Produces:
  - `class ProError extends Error { code: ProErrorCode; resetsAt?: string }`.
  - `toProError(res: Response): Promise<ProError>` — maps by JSON `error` field (unknown or unparseable → by status: 401 unauthorized, 402 upgrade_required, 413 too_large, 429 rate_limited, 503 model_unavailable, else internal_error); keeps server `message`.
  - `fetchMe(token, fetchImpl = fetch): Promise<MeResponse>`; `fetchPricing(fetchImpl = fetch): Promise<Pricing>`; `disconnect(token, fetchImpl = fetch): Promise<void>` (never throws); `streamRequest(token, body, signal, fetchImpl = fetch): Promise<Response>` (throws `ProError` on non-2xx; network failure → `ProError("network")` with message "Can't reach Recap Pro. Check your connection.").
  - `readUiChunks(res: Response): AsyncIterable<UIMessageChunk>` — parse the SSE body into UI message chunks. Prefer the AI SDK's own parser (`parseJsonEventStream` + `uiMessageChunkSchema`, verify names in installed `ai`/`@ai-sdk/provider-utils`); fall back to a small SSE line parser (`data: <json>` lines, ignore `[DONE]`).
  - `trimForPro(system: string, messages: ModelMessage[], limits = { chars: 160_000, messages: 40 }): ModelMessage[]` — drops oldest messages in user/assistant pairs until both limits fit; never drops the last user message and never returns a list that starts with an assistant message; if the remaining messages still exceed the limits, return them as they are and let the server answer 413 (no text truncation).
- [ ] **Step 1: Failing tests**: each status/code mapping incl. `limit_reached` with `resetsAt`; network rejection → `network`; `fetchMe` sends `x-api-key`; `disconnect` swallows errors; `readUiChunks` yields `text-delta` chunks in order from a two-event SSE body split across arbitrary byte boundaries and yields an `error` chunk; `trimForPro` with 45 messages returns ≤ 40 ending in the last user message; with one huge early message drops it; never returns an assistant-first list.
- [ ] **Step 2–4:** run (fail) → implement → run (pass). **Step 5: Commit** `feat: Recap Pro HTTP client, SSE reader and request trimming`.

---

### Task 3: Sign-in, sign-out and refresh in the background

**Files:**
- Create: `src/background/pro-auth.ts`
- Modify: `src/entrypoints/background.ts`, `src/lib/port-protocol.ts`
- Test: `src/background/pro-auth.test.ts`

**Interfaces:**
- Consumes: `proUrl`, `proItem`, `fetchMe`, `disconnect`, `ProError`.
- Produces:
  - Runtime messages: `{ type: "pro-sign-in" }` → `ProAuthResult = { ok: true } | { ok: false; reason: "cancelled" | "failed"; message: string }`; `{ type: "pro-sign-out" }` → `{ ok: true }`; `{ type: "pro-refresh" }` → `{ ok: true; me: MeResponse } | { ok: false; code: ProErrorCode; message: string }`.
  - `parseTokenFromRedirect(url: string | undefined): string | null` (reads `#token=`, URL-decoded; rejects empty).
  - `browserName(): "chrome" | "firefox"` (`import.meta.env.BROWSER`).
  - `signIn(deps)`: builds the connect URL (Global Constraints), awaits `launchWebAuthFlow({ url, interactive: true })`; user-closed window (Chrome: `lastError` "The user did not approve access." / "User cancelled"; Firefox: rejection) → `cancelled`; token → store `{ token, me: null, fetchedAt: 0 }`, then `refresh`; failure of refresh other than 401 still counts as signed in.
  - `refresh(deps)`: no token → `{ ok: false, code: "unauthorized" }`; 401 → clear `proItem` token and me; success → store `me`, `fetchedAt = Date.now()`.
  - `signOut(deps)`: best-effort `disconnect`, then reset `proItem`.
  - `registerProHandlers()` wires the three messages with `sendResponse` + `return true` (Chrome ignores returned Promises — same pattern as `registerKeyCheckHandler`). Registered only when `PRO_ENABLED`.
- [ ] **Step 1: Failing tests** with injected `launchWebAuthFlow`, `fetchMe`, `disconnect` and an in-memory store: token parsed and stored; cancelled; malformed redirect → failed; 401 on refresh clears state; sign-out clears even when disconnect throws; connect URL encodes the redirect and browser param.
- [ ] **Step 2–4:** run → implement → run. **Step 5: Commit** `feat: Recap Pro sign-in, sign-out and refresh`.

---

### Task 4: Pro streaming path

**Files:**
- Modify: `src/background/stream-handler.ts`, `src/lib/port-protocol.ts`, `src/lib/transport.ts`
- Test: `src/background/stream-handler.test.ts` (extend), `src/lib/transport.test.ts` (extend)

**Interfaces:**
- Consumes: `buildSummaryPrompt`, `buildChatSystemPrompt`, `expandUserMessages`, `convertToModelMessages` (already used), `trimForPro`, `streamRequest`, `readUiChunks`, `ProError`, `proItem`, `refresh` semantics for 401.
- Produces:
  - `StreamPortMessage` error variant gains `code?: ProErrorCode` and `resetsAt?: string`.
  - `transport.ts`: `class StreamError extends Error { code?: ProErrorCode; resetsAt?: string }`; `openStream` rejects/errors with `StreamError` carrying the code.
  - `runProStreamRequest(req, deps: { token, post, signal, fetchImpl?, recordUsage? })`: build `{ kind, system, messages }` with the same prompt code as BYOK (summary → `messages: [{ role: "user", content: user }]`), trim chat, call `streamRequest`, forward every chunk except `error`; an `error` chunk (`errorText: "model_unavailable"`) → post `{ type: "error", code: "model_unavailable", message: "Recap Pro lost the model mid-answer. Try again." }`; `ProError` → post error with its code/message/resetsAt; 401 additionally clears the token in `proItem`. Record local usage from the `finish` chunk's `messageMetadata.totalUsage` (verify where AI SDK 7 puts it; the server attaches it to `finish`) via the existing usage recorder.
  - Port handler: `selection.provider === "pro"` → read `proItem.token`; none → post `{ type: "error", code: "unauthorized", message: "Sign in to use Recap Pro." }`; else `runProStreamRequest`. BYOK path unchanged.
- [ ] **Step 1: Failing tests** with a fake fetch returning SSE bodies: summary request body shape (system + one user message, no system role in messages); chat request trimmed to ≤ 40; chunks forwarded then `done`; 402 → error with `upgrade_required`; 429 limit_reached carries `resetsAt`; 401 clears token; mid-stream error chunk after a text delta → the delta was forwarded, then error `model_unavailable`; abort signal aborts the fetch; transport surfaces `StreamError.code`.
- [ ] **Step 2–4:** run → implement → run. **Step 5: Commit** `feat: stream Recap Pro answers through the background port`.

---

### Task 5: `usePro` hook and plan copy

**Files:**
- Create: `src/hooks/usePro.ts`, `src/lib/pro/plan-copy.ts`
- Test: `src/hooks/usePro.test.tsx`, `src/lib/pro/plan-copy.test.ts`

**Interfaces:**
- Consumes: `proItem`, runtime messages from Task 3, `fetchPricing`.
- Produces:
  - `usePro(): { enabled: boolean; signedIn: boolean; me: MeResponse | null; signingIn: boolean; signIn(): Promise<ProAuthResult>; signOut(): Promise<void>; refresh(): Promise<void>; pricing: Pricing | null }`.
  - Refresh policy: on mount when signed in and `fetchedAt` older than 5 minutes; on `visibilitychange` to visible with the same staleness rule; `refresh()` forces. Pricing fetched once per mount when enabled, failures leave `null`.
  - `planLine(me, now)`: `"Trial · 12 of 20 summaries, 40 of 50 messages left"`, `"Pro · renews Nov 27"`, `"Pro · ends Nov 27"` (cancelAtPeriodEnd), `"Pro"` (null period end), `"Trial ended"` (expired). Dates `toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })`.
  - `usageLine(me)`: Pro → `"12 of 300 summaries · 40 of 1,000 messages · resets Nov 1"`; trial → `"12 of 20 summaries · 40 of 50 messages"`.
  - `trialPriceLine(pricing)`: `"20 free summaries. Then {monthly}/month, cancel anytime."` or `"20 free summaries. Then a small monthly plan, cancel anytime."` when pricing is null.
- [ ] **Step 1: Failing tests** for every `planLine`/`usageLine`/`trialPriceLine` case and for the hook's staleness rule (fake timers, mocked `browser.runtime.sendMessage`, in-memory `proItem`).
- [ ] **Step 2–4:** run → implement → run. **Step 5: Commit** `feat: usePro hook and plan copy`.

---

### Task 6: Welcome view and gates

**Files:**
- Create: `src/components/pro/GoogleMark.tsx`, `WelcomeView.tsx`, `AccessGate.tsx`, `UpgradeGate.tsx`, `LimitGate.tsx`, `SignedOutGate.tsx`, `src/components/pro/access.ts`
- Modify: `src/components/shell/Panel.tsx`, `src/components/onboarding/NoKeyGate.tsx` (only to route when Pro is disabled), `src/components/summary/SummaryPanel.tsx`, `src/components/summary/useSummary.ts` (expose `errorCode`), `src/components/chat/ChatPanel.tsx`, `src/components/chat/MessageList.tsx`
- Test: `src/components/pro/access.test.ts`, `src/components/pro/UpgradeGate.test.tsx`, `src/components/onboarding/NoKeyGate.test.tsx` (keep passing)

**Interfaces:**
- Produces:
  - `access(settings, apiKeys, pro: { enabled, signedIn }): "ok" | "needs-sign-in" | "needs-key"` — pure: provider pro → signedIn ? ok : needs-sign-in; BYOK → key ? ok : (pro.enabled ? "needs-sign-in" : "needs-key").
  - `gateFor(code: ProErrorCode | undefined): "upgrade" | "limit" | "signed-out" | null` — 402 → upgrade, `limit_reached` → limit, `unauthorized` → signed-out, else null (inline error).
- Copy (verbatim from spec): Welcome — logo, "Recap", "Summaries, transcript and chat for any YouTube video.", primary "Continue with Google" (inline Google G SVG, no network asset), `trialPriceLine`, secondary "Use my own API key" → existing ConnectView, while waiting "Waiting for Google…" with spinner. Access gate — "Sign in to summarize videos" / "Sign in to chat with videos", primary "Continue with Google", secondary "Use my own key", tertiary text button "Open transcript", rows "20 free summaries" · "No key, no setup" · "Transcript works without it". Upgrade gate — "Your free summaries are used up" (chat: "Your free messages are used up"), body "Recap Pro is {monthly} a month for 300 summaries and 1,000 chat messages. Cancel anytime." (no price → "Recap Pro is a small monthly plan for…"), primary "Get Recap Pro" opens `proUrl("/account?upgrade=monthly")` in a new tab, secondary "Use my own key instead"; after opening, poll `refresh()` every 5 s for 2 minutes while the YouTube tab is visible, stop on `plan === "pro"` and toast "You're on Recap Pro". Limit gate — "Monthly limit reached", "Resets {date}. Switch to your own key to keep going.", secondary "Use my own key". Signed-out gate — "Signed out of Recap Pro", primary "Sign in again". Inline errors: `rate_limited` "Too many requests. Try again in a few minutes."; `too_large` (chat) "This chat is too long for one request. Start a new chat." with the New chat action; `model_unavailable` "Recap Pro can't reach the model right now. Try again in a minute."; `network` "Can't reach Recap Pro. Check your connection."
  - Onboarding view starts at WelcomeView when Pro is enabled; "Use my own API key" switches to ConnectView. Pro disabled → exactly today's flow.
  - Cancelled sign-in resets the button silently; failed shows toast "Couldn't sign in. Try again."
- [ ] **Step 1: Failing tests** for `access` and `gateFor` tables; UpgradeGate polling (fake timers): stops on pro, stops after 2 min, pauses when hidden, single poller across re-renders.
- [ ] **Step 2–4:** run → implement → run. **Step 5: Commit** `feat: Recap Pro welcome screen and access, upgrade, limit and signed-out gates`.

---

### Task 7: Settings, usage and model UI for Pro

**Files:**
- Create: `src/components/pro/AccountRows.tsx`
- Modify: `src/components/shell/SettingsView.tsx`, `src/components/settings/UsageSection.tsx`, `src/components/chat/ModelPicker.tsx` (or its caller), `src/components/summary/SummaryPanel.tsx` / `SummaryDone.tsx` footer meta, `src/components/summary/SummaryActions.tsx` (model group)
- Test: `src/components/pro/AccountRows.test.tsx`

**Interfaces:**
- Settings › Model when provider is pro: API key row replaced by an Account row (avatar with initial fallback, email, "Signed in"), Default model row hidden, plan row `planLine` with a right button "Upgrade" (trial/expired → opens `proUrl("/account?upgrade=monthly")`) or "Manage billing" (pro → opens `proUrl("/account")`), then a "Sign out" ghost button. Not signed in → "Sign in with Google" button. Provider picker lists "Recap Pro" first.
- Usage: provider pro and `me` present → `usageLine(me)` with footnote "Counted by Recap Pro."; otherwise unchanged.
- Chat composer model picker hidden for pro. Summary options model group hidden for pro. Summary footer meta reads "Recap Pro · Detailed · English".
- Opening Settings triggers `refresh()` (staleness rule applies).
- [ ] **Step 1: Failing tests** for AccountRows: signed out → sign-in button; trial → "Upgrade"; pro → "Manage billing"; sign-out calls the hook.
- [ ] **Step 2–4:** run → implement → run. **Step 5: Commit** `feat: Recap Pro account, plan and usage in Settings`.

---

### Task 8: Build, release and docs

**Files:**
- Modify: `.github/workflows/release.yml`, `.github/workflows/ci.yml`, `README.md`, `.env.example`, `CHANGELOG.md`
- Test: `src/lib/pro/manifest.test.ts` (pure helper used by `wxt.config.ts` to compute Pro permissions, if Task 1 inlined it — extract it here)

- [ ] CI builds both variants: default and `WXT_PRO_ORIGIN=https://recapai.dev`. Release zips use `WXT_PRO_ORIGIN: ${{ vars.WXT_PRO_ORIGIN }}` (a repository variable, not a secret — the origin is public) so store builds include Pro, and say so in the README.
- [ ] README: a short "Recap Pro" section (what it is, that it is optional, that self-builders get BYOK unless they set `WXT_PRO_ORIGIN`, how to point a dev build at `http://localhost:3000`), and the privacy section updated to describe Pro traffic.
- [ ] `.env.example`: `WXT_PRO_ORIGIN=` with a comment.
- [ ] CHANGELOG: `## Unreleased` with Recap Pro.
- [ ] Verify all builds; commit `chore: build and document the Recap Pro option`.
