# Recap Pro: hosted tier design

Date: 2026-10-27. Status: approved by Paolo (domain, repo name, Polar, Better Auth, Neon chosen; pricing deferred).

## Intent

Recap is an open-source, bring-your-own-key (BYOK) browser extension for YouTube. Paolo wants a paid hosted tier, **Recap Pro**, that removes the key step entirely: install, sign in with Google, use it, pay when the trial runs out. It should feel like a real product, not a developer tool. He also wants a home for a marketing site. The open-source extension stays free and BYOK.

The thing being sold is convenience, not features. Pro users and BYOK users get the same panel, the same summaries, the same chat. Pro users don't manage a key or a provider account.

## Goals

- Install → "Continue with Google" → summarize a video within a minute, with no key.
- A free trial that follows the Google account, not the browser install.
- A monthly and a yearly plan, bought on a hosted checkout page, with a customer portal for cancelling. Prices are set in Polar and read from there; nothing in the extension or site hardcodes a price. ($5/month and $40/year are the working assumption; Paolo decides later.)
- BYOK remains available to everyone, including Pro users, as a secondary path.
- One extension codebase. The Chrome Web Store build is the open-source build. No fork, nothing to sync by hand.
- One private Next.js app that is the website, sign-in, checkout and API, so the marketing site has a home from day one.

## Non-goals (v1)

- Chrome Web Store submission itself (separate task after this ships).
- Synced history, team plans, usage-based billing, email/password or magic-link sign-in.
- A polished marketing design. The site ships with clean shadcn defaults; Paolo will redesign it with Claude Design later.
- Verifying the Firefox build end-to-end. Firefox stays dev-only.
- Anything that lets the server fetch YouTube pages. Transcripts are always fetched in the user's browser.

## Anti-goals

- Two divergent extension codebases ("Pro edition" vs OSS edition).
- A license-key flow where users paste a key from Paolo instead of from a provider.
- Pro-only features hidden from the open build. If a feature needs gating later it is gated by the server or by an env-flagged private package, never a fork.
- Storing provider API keys anywhere but the user's device (BYOK) or Vercel env (Pro).

## Constraints

- Extension stack is fixed: WXT 0.21, React 19, TypeScript strict, Tailwind v4, shadcn/radix, Phosphor icons, Vercel AI SDK 7, Biome 2, Vitest. Match the existing v3 design language (`docs/design/v3-handoff/`).
- Paolo tests in Chrome himself. Agents verify by build, typecheck, lint and unit tests only. Never drive his browser.
- Keep extension permissions minimal. `storage` and `identity` only, plus host permissions for the four provider APIs and the Pro origin.
- Vercel's free Hobby plan forbids commercial use; the app deploys on Vercel Pro once money is charged. Not a code concern, noted for Paolo.
- Polar's Better Auth adapter requires `@polar-sh/sdk` and `better-auth`; use their current stable versions (verify on npm at build time; do not pin from memory).

## Naming

- Product tier: **Recap Pro**. Provider row in the extension: "Recap Pro" with the note "No key needed. Sign in and go."
- Private repo: `recap-website` (GitHub, PaoloJN, private). One Next.js app.
- Public repo: `recap` (exists). Gains the Pro client.
- Origin: production is **https://recapai.dev**. The app reads `NEXT_PUBLIC_APP_URL`; the extension reads `WXT_PRO_ORIGIN` at build time. Local dev uses `http://localhost:3000`.
- **Pro is a build-time option** (my call). When `WXT_PRO_ORIGIN` is unset, the build is pure BYOK: "Recap Pro" is absent from the provider list, the default provider stays `openai`, onboarding starts at the key screen, and no `identity` permission or Pro host permission is emitted. Anyone building from source gets exactly today's extension. When it is set (Paolo's `.env`, the CI secret for the release and store builds), Pro is listed first and is the default for fresh installs. `PROVIDER_IDS` and `DEFAULT_SETTINGS` derive from one `PRO_ENABLED` constant in `src/lib/pro/config.ts`.

## Architecture

```
Extension (public repo)                       recap-website (private, Vercel)
┌──────────────────────────┐                  ┌──────────────────────────────┐
│ content script (panel)   │                  │ Next.js app router           │
│  provider = "pro"        │  runtime msg     │  /            landing        │
│  Welcome / gates / acct  │ ───────────────▶ │  /pricing  /privacy  /terms  │
│                          │                  │  /account   plan, usage,     │
│ background               │  launchWebAuth   │             billing, devices │
│  pro-sign-in → identity  │ ───────────────▶ │  /extension/connect          │
│  stream → fetch /api/v1  │  x-api-key       │  /api/auth/*  (Better Auth)  │
│  BYOK path unchanged     │ ───────────────▶ │  /api/v1/stream  /me  /disc. │
└──────────────────────────┘                  │  Polar webhooks              │
                                              │  AI Gateway → model          │
                                              │  Neon Postgres via Drizzle   │
                                              └──────────────────────────────┘
```

### Decided: prompts are built in the extension, not on the server

The extension already builds the system prompt, summary prompt and chat messages for BYOK. Pro reuses that exact code: the background builds the prompts and sends `{ kind, system, messages }` to the server. The server never needs the transcript parsing, prompt or type code, so there is nothing shared between the repos and nothing to sync. Trade-off accepted: prompt improvements require an extension release, and the endpoint is technically a general completion proxy. Caps and rate limits bound the abuse; it is a $5 plan.

### Decided: stack for `recap-website`

- Next.js (current stable, App Router), TypeScript strict, Tailwind v4, shadcn/ui, Biome, Vitest.
- Better Auth with Google as the only sign-in method, the `nextCookies` plugin for the web app, and the **API key plugin** (`@better-auth/api-key`) with `enableSessionForAPIKeys: true` for extension tokens. Each connected browser gets its own key, named "Chrome extension" or "Firefox extension" plus the date, 1-year expiry, listed and revocable on `/account`.
- Polar as merchant of record, via `@polar-sh/better-auth` with the `checkout`, `portal` and `webhooks` sub-plugins. Two products, slugs `pro-monthly` and `pro-yearly`, ids from env. Prices are read from Polar's product API on the server and cached for an hour; the site and the extension display whatever Polar says. Sandbox environment in dev, production in prod, selected by env.
- Drizzle ORM on **Neon Postgres provisioned through the Vercel marketplace** (so `DATABASE_URL` is injected into the Vercel project).
- Vercel AI SDK on the server with the **AI Gateway** (plain `creator/model` strings, `AI_GATEWAY_API_KEY` or Vercel OIDC). The Pro model is env `PRO_MODEL`, default `google/gemini-3.8-flash`. The builder verifies the slug exists via `gateway.getAvailableModels()` and picks the cheapest current Gemini Flash if it doesn't.
- Deployed on Vercel from the `recap-website` repo.

## Entitlements

| | Trial | Pro |
|---|---|---|
| Who | every signed-in account, once | active Polar subscription |
| Summaries | 20 total | 300 per calendar month (UTC) |
| Chat messages | 50 total | 1,000 per calendar month (UTC) |
| Model | same as Pro | `PRO_MODEL` |

- A subscription that is cancelled but paid through the period end stays Pro until `currentPeriodEnd`.
- Per-request limits, enforced server-side: body ≤ 512 KB, system + messages text ≤ 160,000 characters, ≤ 40 messages. Over limit → 413. The extension already truncates transcripts at 120,000 characters.
- Per-key rate limit via the API key plugin: 120 requests per hour.
- Usage is counted per request, by kind, and token totals are stored for Paolo's cost tracking. Usage is counted when the stream completes or is aborted after first token; a request that fails before the first token is not counted.

## Data model (`recap-website`)

Better Auth tables (`user`, `session`, `account`, `verification`, `apikey`) as generated by its CLI, plus:

- `subscription`: `userId` (unique), `polarSubscriptionId`, `polarCustomerId`, `productId`, `status` (Polar status string), `currentPeriodEnd`, `cancelAtPeriodEnd`, `updatedAt`. Upserted from Polar webhooks (`onCustomerStateChanged`, `onSubscriptionUpdated`, `onSubscriptionActive`, `onSubscriptionCanceled`, `onSubscriptionRevoked`).
- `usage`: `userId`, `period` (`"trial"` or `"YYYY-MM"`), `summaries`, `chats`, `inputTokens`, `outputTokens`, `updatedAt`. Primary key (`userId`, `period`). Trial usage accrues under `"trial"` until the account becomes Pro; Pro usage accrues under the calendar month.

Plan resolution: `pro` if a `subscription` row is `active`, or `canceled` with `currentPeriodEnd` in the future; else `trial` while at least one trial counter is under its cap; else `expired`.

Caps apply **per kind, independently** (my call). A trial user who has used all 20 summaries can still chat until 50 messages; `/api/v1/stream` checks the counter for the request's `kind` and answers 402 (trial) or 429 (Pro) for that kind only. The panel gates per tab: the Summary tab can show the upgrade gate while Chat still works. `/me` therefore returns both counters and both limits, and the Settings plan row reads "Trial · 12 of 20 summaries, 40 of 50 messages left".

## API (`recap-website`)

All under `/api/v1/`, authenticated with the `x-api-key` header (the extension's device token). CORS: `Access-Control-Allow-Origin: *` on `/api/v1/*` with `x-api-key, content-type` allowed and no credentials, plus `OPTIONS` handling; the extension also declares the Pro origin as a host permission so Chrome and Firefox skip CORS from the background anyway.

- `POST /api/v1/stream` — body `{ kind: "summary" | "chat", system: string, messages: ModelMessage[] }`. Returns a UI message stream (`toUIMessageStreamResponse()`), including usage in the finish metadata. Increments `usage`.
- `GET /api/v1/me` — `{ user: { email, name, image }, plan: "trial" | "pro" | "expired", usage: { summaries, chats, summaryLimit, chatLimit, resetsAt: string | null }, subscription: { status, currentPeriodEnd, cancelAtPeriodEnd } | null }`.
- `POST /api/v1/disconnect` — revokes the calling key. 204.
- `GET /api/v1/pricing` — public, no auth, cached: `{ monthly: { amount, currency, display: "$5" }, yearly: { amount, currency, display: "$40" } }` from Polar. The extension fetches it for copy such as "Then {monthly}/month" and omits the price if the fetch fails.
- Errors as JSON `{ error, message }`: 401 `unauthorized` (bad, revoked or expired key), 402 `upgrade_required` (trial used up, not Pro), 429 `limit_reached` (Pro monthly cap; includes `resetsAt`) or rate limit, 413 `too_large`, 503 `model_unavailable`.

Web-only endpoints (cookie session): `POST /api/extension/token` (creates the device key and returns it; only called by `/extension/connect`), Better Auth routes under `/api/auth/*`, Polar webhook route as the adapter mounts it.

## Sign-in handoff (extension ↔ site)

1. The panel calls the background with a `pro-sign-in` runtime message (the identity API is unavailable in content scripts).
2. Background: `browser.identity.launchWebAuthFlow({ url: PRO_ORIGIN + "/extension/connect?redirect_uri=" + encodeURIComponent(browser.identity.getRedirectURL("connect")) + "&browser=chrome|firefox", interactive: true })`.
3. `/extension/connect` validates `redirect_uri`: in production it must match one of `EXTENSION_REDIRECT_ALLOWLIST` (comma-separated exact origins such as `https://<store-extension-id>.chromiumapp.org`); in development any `https://*.chromiumapp.org` or `https://*.extensions.allizom.org` origin is accepted. Invalid → 400 page, no redirect.
4. If not signed in, the page starts Google sign-in with `callbackURL` back to itself. Once signed in it shows the account (avatar, email) and a single "Connect Recap" button, so a user always sees which account is being connected.
5. Clicking Connect calls `POST /api/extension/token` (cookie session), which creates an API key for the user (name from the `browser` param plus date, `expiresIn` 365 days), then the page navigates to `redirect_uri#token=<key>`.
6. `launchWebAuthFlow` resolves with that URL. Background parses the fragment, stores the token, calls `/api/v1/me`, stores the snapshot, and replies to the panel. A cancelled window resolves to "cancelled", not an error toast.
7. Sign out from the extension calls `/api/v1/disconnect` (best effort) and clears local Pro state. Revoking on `/account` makes the extension's next call 401, which the panel shows as "Signed out. Sign in again."

## Extension changes (public repo)

### Provider model

- `ProviderId` gains `"pro"`. `PROVIDERS.pro`: label "Recap Pro", tagline "No key needed. Sign in and go", tag "Recommended", a single model entry labelled "Recap Pro" (model id `"pro"`). No `keyUrl`.
- Default provider for fresh installs becomes `"pro"`. Existing installs keep their stored provider (migration leaves it).
- New storage item `local:pro`: `{ token: string | null; account: { email, name, image } | null; me: MeResponse | null; fetchedAt: number }`.
- "Has access" for gating is: provider `pro` and a token, or provider BYOK and a key for it.
- `/me` is refreshed when the panel opens, when Settings opens, after sign-in, after a 402/429, and when the YouTube tab regains visibility if the snapshot is older than 5 minutes.

### Background

- `pro-sign-in` and `pro-sign-out` runtime message handlers (identity flow above). Also `pro-refresh` to refetch `/me`.
- Stream handler: when `selection.provider === "pro"`, build the prompts exactly as the BYOK path does, drop the oldest chat turns (never the system prompt or the latest user message) until the request is under the server's character and message limits, then POST to `/api/v1/stream` with the device token and forward the returned UI message stream chunks through the existing port. Non-2xx responses map to port errors carrying a `code` (`unauthorized` | `upgrade_required` | `limit_reached` | `too_large` | `model_unavailable` | `network`) so the panel can render the right state instead of a generic error. Usage is recorded locally from the finish metadata, as the BYOK path does.
- Manifest: `identity` permission; host permission for the Pro origin.

### Panel UI

Match the v3 design language: same type scale, radii, `card`/`secondary` surfaces, Phosphor icons, primary/secondary button styles from `summary/buttons.ts`.

- **Welcome view** (the onboarding view now starts here; the key screen stays as its second step). Nothing opens automatically on first run (my call): the panel still lands on the main view, the Transcript tab works without signing in, and the no-access gate in Summary and Chat carries "Continue with Google" directly, so the one-minute path does not need a first-run flag.
  - Logo, "Recap" wordmark, one line: "Summaries, transcript and chat for any YouTube video."
  - Primary button "Continue with Google" (Google "G" mark drawn inline as SVG, no network asset).
  - Under it: "20 free summaries. Then {monthly}/month, cancel anytime." (price from `/api/v1/pricing`; "Then a small monthly plan, cancel anytime." if unavailable).
  - Secondary: "Use my own API key" → existing `ConnectView`.
  - Footer rows: "Transcript works without signing in" and "Your key never leaves this device" (shown on the key path only).
  - While the sign-in window is open: button shows a spinner and "Waiting for Google…". Cancel resets it.
- **No-access gate** (today's `NoKeyGate`): heading "Sign in to summarize videos" / "…chat with videos"; primary "Continue with Google"; secondary "Use my own key"; tertiary text button "Open transcript". The three info rows become: "20 free summaries", "No key, no setup", "Transcript works without it".
- **Upgrade gate** (shown in Summary and Chat on a 402): heading "Your free summaries are used up", body "Recap Pro is {monthly} a month for 300 summaries and 1,000 chat messages. Cancel anytime." (price from `/api/v1/pricing`), primary "Get Recap Pro" (opens `PRO_ORIGIN/account?upgrade=monthly` in a new tab), secondary "Use my own key instead". After the tab is opened, the panel polls `/me` every 5 s for 2 minutes while the YouTube tab is visible, and clears the gate as soon as the plan is `pro`, with a toast "You're on Recap Pro".
- **Limit gate** (429): "Monthly limit reached" with "Resets {date}. Switch to your own key to keep going." and the "Use my own key" secondary.
- **Signed-out gate** (401): "Signed out of Recap Pro" with "Sign in again".
- **Too large** (413, only reachable if trimming could not get under the limit): in Chat, an inline error "This chat is too long for one request. Start a new chat." with the existing New chat action; in Summary, the standard error card.
- **Settings › Model**: the Provider picker lists "Recap Pro" first. When Pro is selected: the API key row is replaced by an **Account** row (avatar, email, "Signed in"), the Default model row is hidden, and a plan row shows "Trial · 12 of 20 summaries left" / "Pro · renews Nov 27" / "Pro · ends Nov 27" / "Trial ended" with a right-side button: "Upgrade" (trial/expired) or "Manage billing" (Pro; opens `PRO_ORIGIN/account`). A "Sign out" ghost button sits under it. When no account: a "Sign in with Google" button.
- **Settings › Usage**: for Pro shows the server counts ("12 of 300 summaries · 40 of 1,000 messages · resets Nov 1"); for BYOK unchanged.
- **Chat composer model picker**: hidden when provider is Pro (one model).
- **Summary footer meta**: shows "Recap Pro · Detailed · English".
- Copy rule: never say "cloud". The tier is "Recap Pro"; the free path is "your own key".

### Tests (extension)

Unit tests for: plan/gate derivation from `local:pro` + settings; the Pro stream path mapping HTTP statuses to port error codes (with a fake fetch); `launchWebAuthFlow` result parsing (fragment token, cancelled, malformed); settings migration keeping existing providers; `mergeSettings` accepting `"pro"`.

## Site (`recap-website`) pages

- `/` landing: hero (headline, one paragraph, "Add to Chrome" button to `NEXT_PUBLIC_STORE_URL` or "Coming soon" when unset, "Open source on GitHub" link), three feature blocks (summaries with timestamps, searchable transcript, chat), pricing teaser, footer with privacy, terms, GitHub.
- `/pricing`: Free (bring your own key, unlimited, open source) vs Pro (monthly/yearly toggle with prices from Polar, 300 summaries, 1,000 chat messages, no setup). Buttons start Polar checkout via the Better Auth client (`authClient.checkout({ slug })`); signed-out users are sent through Google sign-in first and return to checkout.
- `/account` (signed in): plan card with usage bars, "Manage billing" (Polar portal), "Connected browsers" list with revoke, "Sign out". `?upgrade=monthly|yearly` triggers checkout on load.
- `/checkout/success`: "You're on Recap Pro. Head back to YouTube, the panel will pick it up." 
- `/extension/connect`: the handoff page above.
- `/privacy`, `/terms`: plain pages. Privacy must state: transcripts and chat messages are sent to the Pro server and the model provider only when using Recap Pro; nothing is stored beyond request counts and token totals; BYOK traffic never touches the server.

Design: shadcn defaults, system font, light/dark via `next-themes`. Deliberately plain; Paolo will replace it.

## Environment (`recap-website`)

`DATABASE_URL`, `BETTER_AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, `POLAR_ENVIRONMENT` (`sandbox` | `production`), `POLAR_PRODUCT_MONTHLY_ID`, `POLAR_PRODUCT_YEARLY_ID`, `AI_GATEWAY_API_KEY` (optional on Vercel, OIDC otherwise), `PRO_MODEL`, `EXTENSION_REDIRECT_ALLOWLIST`, `NEXT_PUBLIC_STORE_URL` (optional), `NEXT_PUBLIC_GITHUB_URL`. `.env.example` documents each.

## Things Paolo sets up himself (not code)

1. Domain and DNS → Vercel.
2. Google Cloud OAuth client (Web application) with redirect `https://<domain>/api/auth/callback/google` and `http://localhost:3000/api/auth/callback/google`.
3. Polar organization, two subscription products (monthly and yearly; prices his call), an access token, a webhook endpoint pointing at the deployed app. Sandbox first.
4. Vercel project importing `recap-website`, Neon added from the Vercel marketplace, env vars filled, AI Gateway enabled.
6. Chrome Web Store developer account ($5) when ready to list; its extension id goes into `EXTENSION_REDIRECT_ALLOWLIST`.

## Verification

- `recap-website`: `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm build` green. Unit tests for plan resolution, usage accounting (trial vs month rollover, cancelled-with-period-end), redirect allowlist validation, webhook payload → subscription row mapping, and the `/api/v1/stream` handler's 401/402/413/429 paths with a stubbed model.
- Extension: existing 245 tests plus the new ones; `pnpm build` and `pnpm build:firefox` green.
- End-to-end in a real browser: Paolo, using Polar sandbox and a local `recap-website`.

## Left to the builder

- Exact Drizzle schema details, migrations tooling, and how Better Auth's schema is generated.
- How the background consumes the SSE stream (the AI SDK's transport utilities or its stream parsers; either is fine as long as chunks reach the existing port protocol unchanged).
- Component file layout for the new gates, as long as they follow the existing `components/onboarding` and `components/summary` conventions.
- Landing page copy beyond what is specified.
- Whether `/api/v1/stream` lives in one route handler or two.

## Repos, branches, where things live

- `recap-website` is scaffolded at `~/Projects/recap-website` and pushed to a new **private** GitHub repo `PaoloJN/recap-website` (Paolo named the repo, which is the go-ahead).
- Extension work happens on a `pro` branch off `main` in the public repo, merged when Paolo has tested it against a local `recap-website` with Polar sandbox.
- The two plans are executed one after the other, backend first, because the extension's Pro path is tested against the real stream endpoint shape.

## Answered by Paolo (2026-10-27)

- Domain: recapai.dev. Repo: `PaoloJN/recap-website` (private). Payments: Polar. Auth: Better Auth. Database: Neon on Vercel, ORM my call (Drizzle). Pricing: decided later, so prices live in Polar only.
