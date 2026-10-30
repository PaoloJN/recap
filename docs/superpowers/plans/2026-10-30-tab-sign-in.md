# Tab sign-in Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `launchWebAuthFlow` popup with sign-in in a normal recapai.dev tab: plan picker, then auto-return to the YouTube video.

**Architecture:**
- The extension starts a one-time link (`code`, plus a PKCE-style `challenge`) on the server and opens `/sign-in?link=…&return=…` in a normal tab.
- The website approves the link on a confirm click (and finishes it after any checkout).
- The panel polls a claim endpoint through the background. The background stores the device key, then closes the sign-in tab and focuses the original tab.

**Tech Stack:**
- Backend `~/Projects/recap-website`: Next.js 16, Better Auth 1.7 (+ api-key, Polar plugins), Drizzle/Neon, Vitest, Biome.
- Extension `~/Projects/youtube-ai-extension`: WXT 0.21, React 19, Vitest, Biome.

**Spec:** `docs/superpowers/specs/2026-10-30-tab-sign-in-design.md` (extension repo). It amends `docs/superpowers/specs/2026-10-27-recap-pro-design.md`.

## Global Constraints

- **Repos and branches:**
  - Backend tasks (1–4) run in `/Users/paolonessim/Projects/recap-website` on branch `tab-sign-in`; create it from `main` if missing.
  - Extension tasks (5–6) run in `/Users/paolonessim/Projects/youtube-ai-extension` on branch `pro`.
  - Never push or merge.
- **Verification:**
  - Backend: `pnpm check && pnpm typecheck && pnpm test` must pass.
  - Extension: `pnpm check && pnpm typecheck && pnpm test && pnpm build && WXT_PRO_ORIGIN=http://localhost:3000 pnpm build && WXT_PRO_ORIGIN=http://localhost:3000 pnpm build:firefox` must pass.
- **No browser driving.** Never open or drive Chrome or any browser. Verify with tests and builds only.
- **Code style:** match the surrounding code (comment density, naming, dependency-injected `deps` objects for testability, as in `src/lib/api/*.ts`).
- **Commits:** every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Copy and naming:** never "cloud". The product is "Recap" and the tier is "Recap Pro". Copy is short and plain, in sentence case.
- **Link timing:**
  - Expiry: 30 minutes after creation.
  - Extension poll interval: 1500 ms.
  - Website fallback redirect delay: 2000 ms.
- **Device keys** keep today's values: name from `deviceKeyName(browser, now)`, `DEVICE_KEY_TTL_SECONDS`, and `DEVICE_KEY_RATE_LIMIT`.

## Review Focus

1. **Phishing.** Approving a link without an explicit click on a page that shows the signed-in email must be impossible. Pin this with a test that the approve API requires same-origin plus a session, and that no page approves on load.
2. **Double claim.** Two concurrent claims after approval must mint exactly one key. Use a conditional update on `claimed_at IS NULL`, tested.
3. **Open redirect through `return`.** Pin these with tests:
   - `javascript:`, `//evil.com`, `https://youtube.com.evil.com` and `https://evil.com/?x=youtube.com` are all rejected.
   - `https://www.youtube.com/watch?v=abc&t=42` survives with `v` and `t` only.
4. **MV3 worker restart mid-flow.** Flow state must live in `storage.session`. A poll after a restart must still claim. Pin this with a test that rebuilds deps from storage.
5. **User closed the YouTube tab.** Focusing the source tab must fail silently and the flow must still clear. Pin this with a test where `tabs.update` rejects.

---

### Task 1: Link store and return-URL validation (backend)

**Files:**
- Create: `src/db/schema/link.ts`; export it from `src/db/schema/index.ts`
- Create: migration `drizzle/0002_*.sql` via `pnpm db:generate`
- Create: `src/lib/link.ts`, `src/lib/link.test.ts`
- Create: `src/lib/return-url.ts`, `src/lib/return-url.test.ts`

**Interfaces:**

`extensionLink` table (`extension_link`):
- `code text pk`
- `challenge text not null`
- `browser text`
- `userId text null references user.id on delete cascade`
- `approvedAt`, `finishedAt`, `claimedAt` (timestamptz null)
- `createdAt timestamptz default now not null`
- `expiresAt timestamptz not null`

`src/lib/link.ts` (`LinkDeps` wraps the db and `createKey`; the default deps use `getDb()` and `auth.api.createApiKey` exactly as `src/lib/api/extension-token.ts` does today):
- `LINK_TTL_MS = 30 * 60_000`
- `createLink(input: { challenge: string; browser: string | null }, deps?): Promise<{ code: string; expiresAt: Date }>`
  - The code is 32 random bytes, base64url.
  - Deletes expired rows first (best effort).
- `approveLink(code: string, userId: string, deps?): Promise<"ok" | "not_found" | "expired" | "conflict">`
  - Same user again → `"ok"`.
- `finishLink(code: string, userId: string, deps?): Promise<"ok" | "not_found" | "expired">`
  - Only the approving user; anyone else → `"not_found"`.
- `claimLink(code: string, verifier: string, deps?)`, returning one of:
  - `{ status: "pending" }`
  - `{ status: "approved"; key: string; finished: boolean }`
  - `{ status: "claimed"; finished: boolean }`
  - `{ status: "expired" }`
  - `{ status: "invalid" }`

  Rules:
  - The verifier is checked as `base64url(sha256(verifier)) === challenge` with `timingSafeEqual`.
  - Minting happens only when a conditional `UPDATE … SET claimed_at = now() WHERE code = $1 AND claimed_at IS NULL AND user_id IS NOT NULL RETURNING …` returns a row.

`src/lib/return-url.ts`:
- `safeReturnUrl(raw: string | null): string | null`
  - Allowed hosts: `youtube.com`, `www.youtube.com`, `m.youtube.com`, `youtu.be`. `https:` only.
  - Allowed paths: `/watch` (keeps only `v` and `t`), `/shorts/<id>`, `youtu.be/<id>` (keeps `t`).
  - Returns a normalised string, or `null`.

- [ ] **Step 1: Write the tests first, then implement.**
  - `return-url.test.ts`: every case in Review Focus 3, plus shorts, youtu.be, and `t` preserved.
  - `link.test.ts`, with a fake deps object (an in-memory map that implements the conditional claim). Cover:
    - create → claim is `pending`
    - approve → claim is `approved` with a key, `finished:false`
    - a second claim is `claimed`
    - `finishLink` → claim is `claimed`, `finished:true`
    - a wrong verifier is `invalid`
    - an unknown code is `invalid`
    - past `expiresAt` is `expired` (for claim, approve and finish)
    - approve by another user is `conflict`
    - finish by another user is `not_found`
    - two concurrent claims call `createKey` exactly once
    - `createKey` receives `deviceKeyName(browser, now)`, `DEVICE_KEY_TTL_SECONDS` and the `DEVICE_KEY_RATE_LIMIT` fields
- [ ] **Step 2: Implement both modules and the schema, then `pnpm db:generate`.** Commit the migration.
- [ ] **Step 3: Verify (backend command), then commit.** Message: `feat: one-time extension link store and YouTube return-URL validation`.

### Task 2: Link API routes (backend)

**Files:**
- Create: `src/lib/api/link.ts`, `src/lib/api/link.test.ts`
- Create routes:
  - `src/app/api/v1/link/route.ts` (POST, OPTIONS)
  - `src/app/api/v1/link/claim/route.ts` (POST, OPTIONS)
  - `src/app/api/link/approve/route.ts` (POST)
  - `src/app/api/link/finish/route.ts` (POST)
- Move `isSameOriginRequest` from `src/lib/extension-redirect.ts` into `src/lib/same-origin.ts`, and update its importers (`src/lib/api/account-devices.ts` and others).

**Interfaces:**
- `startLink(req, deps?)`
  - Body `{ challenge: string (43 chars, base64url), browser?: "chrome" | "firefox" }`.
  - Returns `200 { code, expiresAt }`; a bad body → `400 bad_request`.
  - Wrapped in `withCors`, no auth.
- `claim(req, deps?)`
  - Body `{ code, verifier }`.
  - Responses:
    - `pending` → `200 { status: "pending" }`
    - `approved` → `200 { status: "approved", key, finished }`
    - `claimed` → `200 { status: "claimed", finished }`
    - `expired` → `410 expired`
    - `invalid` or a bad body → `400 bad_request`
  - `cache-control: no-store` on every response. `withCors`.
- `approve(req, deps?)` and `finish(req, deps?)`
  - Body `{ code }`.
  - Same-origin, using `NEXT_PUBLIC_APP_URL`'s origin; otherwise `403 forbidden`.
  - Reject the `x-api-key` header with 401. Web session via `getWebSession`, else `401`.
  - Map results:
    - `ok` → `200 { ok: true }`
    - `not_found` → `404`
    - `expired` → `410`
    - `conflict` → `409`
  - No CORS.
- Error bodies use the existing `{ error, message }` shape. `/api/v1` uses `apiError`; the same-origin routes use a local `fail` like `extension-token.ts`.

- [ ] **Step 1: Tests.** One per status mapping above, plus:
  - Approve without an Origin and without `sec-fetch-site: same-origin` → 403.
  - Approve with `x-api-key` → 401.
  - Claim responses carry `access-control-allow-origin: *` and `cache-control: no-store`.
- [ ] **Step 2: Implement the handlers and routes.**
- [ ] **Step 3: Verify, then commit.** Message: `feat: link start, claim, approve and finish endpoints`.

### Task 3: Sign-in → plan picker → return pages; remove the popup path (backend)

**Files:**
- Modify: `src/app/(site)/sign-in/page.tsx`, `SignInButton.tsx`
  - Accept `link` and `return`; the callback becomes `/connect?link=…&return=…`.
  - Heading "Sign in to Recap". The sub-line names nothing provider-specific.
- Create: `src/app/(site)/connect/page.tsx`, `ConnectFlow.tsx` (client), `connect-state.ts`, `connect-state.test.ts`
- Modify: `src/app/(site)/checkout/success/page.tsx` and a new client part that finishes a pending link and returns.
- Modify: `src/lib/auth.ts`; `successUrl` stays `/checkout/success?checkout_id={CHECKOUT_ID}`.
- Delete:
  - `src/app/extension/` (the whole connect page)
  - `src/app/api/extension/token/`
  - `src/lib/api/extension-token.ts` and its test
- Shrink `src/lib/extension-redirect.ts` to `deviceKeyName`, or move `deviceKeyName` into `src/lib/link.ts` and delete the file.
- Modify: `src/lib/env.ts` and `env.test.ts` (drop `EXTENSION_REDIRECT_ALLOWLIST`), `.env.example`, `src/lib/auth-guards.ts` if it references the removed paths.
- Modify the README's Setup and "How the extension talks to this" sections to describe the link flow; remove the allowlist step.

**Interfaces:**

`connectView(input)` in `connect-state.ts`: `{ signedIn: boolean; isPro: boolean; hasLink: boolean; linkState: "valid" | "expired" | "missing" }` → `"sign-in" | "expired" | "pro-confirm" | "plans"`. Rules:
- No session → redirect to `/sign-in` carrying `link` and `return`.
- A link that is expired or unknown → `expired` ("This sign-in link expired. Go back to YouTube and click Sign in again.").
- Pro → `pro-confirm`.
- Otherwise → `plans`.
- No `link` param (the upgrade path from the panel) is the same, minus approve and finish.

`/connect` page (server component):
- Validates `return` with `safeReturnUrl`.
- Loads the session, the Pro status (`isProActive(getSubscription)`), the pricing (`getPricing`, and the card shows no price if that fails), and the link row (expired or missing).
- Shows "Signed in as <email>" on every view. This is the anti-phishing context.

`ConnectFlow` (client):
- **pro-confirm:** one button, "Back to your video" (or "Done" without a return URL). It calls approve then finish, then shows "You're signed in. Taking you back…". After 2000 ms it sets `location.href = return`; without a return URL it shows "You can close this tab."
- **plans:**
  - Monthly and Yearly cards, reusing the price display from `src/lib/polar.ts` `Pricing`.
  - Each "Choose" button calls approve (when there's a link). It saves `{ link, return }` in `sessionStorage['recap:pending-link']`, then calls `authClient.checkout({ slug })`, the slugs from `src/app/(site)/pricing/slugs.ts`.
  - "Continue without a plan" is a small text button, top-right of the card area. It does approve + finish + return, like pro-confirm.
- **Checkout success client part:**
  - Reads and clears `recap:pending-link`. If there is a link, it calls finish.
  - Shows "You're on Recap Pro." and a "Back to your video" button.
  - Auto-redirects to `return` after 2000 ms when there is one.
- **Any approve or finish failure** shows "Couldn't finish signing in. Try again." with a retry. A 410 shows the expired copy.
- **Nothing approves on page load.** Every approve comes from a click (Review Focus 1).

- [ ] **Step 1: Tests.**
  - `connect-state.test.ts`: every branch.
  - The sign-in page's callback builder: `link` and `return` are carried over, and a `return` that fails `safeReturnUrl` is dropped. Put the builder in a pure function in `sign-in/callback-path.ts` next to `safeCallbackPath`, and make sure the result still passes `safeCallbackPath`.
  - The env test no longer mentions the allowlist.
- [ ] **Step 2: Implement the pages, delete the popup path, and update the README and `.env.example`.**
- [ ] **Step 3: Verify, then commit.** Message: `feat: sign in through a normal tab with plan picker and return to the video`.

### Task 4: Sign out everywhere (backend)

**Files:**
- Create: `src/lib/api/sign-out-everywhere.ts` and its test.
- Create: `src/app/api/account/sign-out-everywhere/route.ts` (POST).
- Modify: `src/app/(site)/account/AccountActions.tsx`, adding a "Sign out everywhere" button.

**Interfaces:**
- `signOutEverywhere(req, deps?)`
  - Same-origin plus a web session; reject `x-api-key`.
  - Deletes every `apikey` row with `referenceId = userId`, then revokes every session (`auth.api.revokeSessions({ headers })`).
  - Returns `200 { ok: true }`.
- In the UI, the button uses a confirm step on the page itself (no `window.confirm`): "This signs you out here and disconnects Recap on every browser." With a "Sign out everywhere" button. On success → `location.href = "/"`.

- [ ] **Step 1: Tests:**
  - 403 for a cross-origin request
  - 401 with no session
  - 401 with `x-api-key`
  - keys are deleted for the session user only, then sessions are revoked
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Verify, then commit.** Message: `feat: sign out everywhere from the account page`.

### Task 5: Background link flow; drop identity (extension)

**Files:**
- Rewrite: `src/background/pro-auth.ts`, `src/background/pro-auth.test.ts`
- Modify:
  - `src/lib/pro/api.ts` (+ tests): add `startLink` and `claimLink`
  - `src/lib/pro/manifest.ts` (+ test): Pro adds no permissions
  - `src/lib/port-protocol.ts`
  - `src/lib/storage.ts`: a `session:proLink` item
  - `src/hooks/usePro.ts` (+ test)
- Check that `wxt.config.ts` no longer adds `identity`.

**Interfaces:**
- `api.ts`:
  - `startLink(challenge: string, browser: "chrome" | "firefox"): Promise<{ code: string; expiresAt: string }>`
  - `claimLink(code: string, verifier: string)`, returning one of:
    - `{ status: "pending" }`
    - `{ status: "approved"; key: string; finished: boolean }`
    - `{ status: "claimed"; finished: boolean }`
    - `{ status: "expired" }`

    It throws `ProError` like the other calls; 410 maps to `{ status: "expired" }`.
- Storage: `proLinkItem = storage.defineItem<ProLink | null>("session:proLink", { fallback: null })` with `ProLink = { code; verifier; signInUrl; signInTabId: number | null; sourceTabId: number | null; expiresAt: string; claimed: boolean }`.
- Messages (replacing `pro-sign-in`; keep `pro-sign-out` and `pro-refresh`):
  - `{ type: "pro-link-start", returnUrl: string | null }` → `{ ok: true } | { ok: false, message }`
    - Makes the verifier and challenge with WebCrypto.
    - Calls `startLink`.
    - Opens `proUrl('/sign-in?link=<code>' + (returnUrl ? '&return=<enc>' : ''))` with `browser.tabs.create({ url, active: true })`.
    - Stores `ProLink`, with `sourceTabId` taken from `sender.tab?.id`.
  - `{ type: "pro-link-poll" }` → `{ state: "idle" | "pending" | "signed-in" | "done" | "expired" | "error" }`. One claim per call:
    - `approved` → save the token via the existing `proItem` (as sign-in does today), set `claimed`, refresh `me`.
    - When `finished` and claimed → `tabs.remove(signInTabId)`, then `tabs.update(sourceTabId, { active: true })` and `windows.update(tab.windowId, { focused: true })`. Each is wrapped in try/catch. Then clear `proLinkItem` and return `done`.
    - Past expiry, or `expired` → clear, return `expired`.
    - A network error → `error`, and the flow is kept.
  - `{ type: "pro-link-reopen" }`: `tabs.update(signInTabId, {active:true})`, falling back to `tabs.create({ url: signInUrl })` and storing the new id.
  - `{ type: "pro-link-cancel" }`: clears the flow.
- `usePro` exposes:
  - `startSignIn(returnUrl)`
  - `pollLink()`
  - `reopenSignIn()`
  - `cancelSignIn()`
  - `linkPending: boolean`, derived from `proLinkItem` watched in the content script. `storage.session` is not readable from content scripts by default, so call `browser.storage.session.setAccessLevel({ accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" })` in the background on Chrome, and guard it for Firefox. If that is not possible, keep `linkPending` in panel state and have the background return the state.
- Remove `launchWebAuthFlow`, `getRedirectURL` and every `identity` reference.

- [ ] **Step 1: Tests (fake deps, as today's pro-auth tests).**
  - start: stores the flow, opens the right URL, uses `sourceTabId` from the sender, and replaces a previous flow.
  - poll: pending, approved (token saved), finished (tabs closed and source focused, flow cleared), expired, network error (flow kept).
  - Worker restart: new deps reading the same storage still claim (Review Focus 4).
  - `tabs.update` rejecting still clears the flow and returns `done` (Review Focus 5).
  - reopen falls back to create.
  - The manifest adds no permissions for a Pro origin.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Verify (extension command), then commit.** Message: `feat: sign in to Recap Pro through a normal tab instead of a popup window`.

### Task 6: Panel sign-in and waiting states (extension)

**Files:**
- Modify:
  - `src/components/pro/AccessGate.tsx`, `SignedOutGate.tsx`, `AccountRows.tsx`, `useProSignIn.ts`, `GoogleButton.tsx` (rename it to `SignInButton.tsx`; drop the Google mark from the button)
  - `UpgradeGate.tsx`: opens `proUrl('/connect?return=<enc>')`
  - `AccountRows.tsx`: the Upgrade link uses the same URL
- Create:
  - `src/components/pro/SignInWaiting.tsx`
  - `src/components/pro/useLinkPoll.ts` (+ test)
  - `src/lib/pro/return-url.ts` (+ test): `currentReturnUrl(): string | null` reads `location.href` for `/watch` (`v`) and `/shorts/`, and adds `t=<floor(video.currentTime)>` from the page's main `video` element when it's above 0.
- Update the README's Recap Pro section (sign-in opens a tab; no extra permission) and add a `## Unreleased` line to `CHANGELOG.md`.

**Interfaces:**
- `useLinkPoll(active: boolean)` sends `pro-link-poll` every 1500 ms while `active`.
  - On `signed-in` or `done`, it switches the provider to `"pro"` (as `useProSignIn` does today), returns to the main view and shows the toast "Signed in to Recap Pro" once.
  - On `expired`, it shows the toast "Sign-in timed out. Try again." and stops.
  - It keeps polling across `error`.
  - It cleans up on unmount.
- `SignInWaiting`:
  - Built on `GateLayout`, title "Finish signing in in the other tab".
  - Body: "Recap will pick it up as soon as you're done."
  - Buttons: "Open it again" (primary), then "Cancel" (secondary, calls `cancelSignIn`).
- AccessGate, SignedOutGate and the Settings account row render `SignInWaiting` (the gate) or a "Waiting for sign-in…" note (Settings) while `linkPending`.
- The sign-in button label is "Sign in". AccessGate keeps "Use my own key" and "Open transcript".

- [ ] **Step 1: Tests.**
  - `useLinkPoll`: interval, stop on done or expired, keeps going on error, toast once, cleanup.
  - `currentReturnUrl`: watch with time, shorts, a non-video page → null.
  - Update the existing gate and AccountRows tests for the new label and the waiting state.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Verify, then commit.** Message: `feat: panel waiting state and return-to-video for tab sign-in`.
