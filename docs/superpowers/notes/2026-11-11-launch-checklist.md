# Launch checklist: Recap on the Chrome Web Store with Recap Pro

Written 2026-11-11. Goal: a stranger can find Recap in the store, install it, use it, and pay for Pro
without help. Tick items in order; each step assumes the ones above it.

Owner key: **P** = Paolo (accounts, dashboards, cards), **C** = Claude (code).

## 1. Merge what's built

- [ ] **C** Merge extension `pro` into `main` and push (36 commits).
- [ ] **C** Merge website `tab-sign-in` into `main` and push (8 commits).
- [ ] **C** Commit `docs/superpowers/notes/2026-10-29-roadmap-and-growth.md`; delete the empty `notes.md`.

## 2. Production accounts and infra

- [ ] **P** Neon: create the production database (Vercel marketplace), copy `DATABASE_URL`.
- [ ] **P** Vercel: create the `recap-website` project from the GitHub repo, attach `recapai.dev`
      (apex) and redirect `www` to the apex. Enable Vercel Analytics.
- [ ] **P** Google Cloud: OAuth client with redirect `https://recapai.dev/api/auth/callback/google`;
      consent screen published ("In production"), not "Testing", so anyone can sign in.
- [ ] **P** Polar: production organization, Monthly and Yearly products with final prices
      (working assumption $5/mo, about $50/yr), webhook pointed at
      `https://recapai.dev/api/webhooks/polar` with the events the site handles, copy the token,
      webhook secret and both product IDs.
- [ ] **P** AI Gateway: buy credits so `PRO_MODEL` can be the real model instead of the free-tier fallback.
- [ ] **P** Vercel env vars (production): every key from `.env.example`, with
      `POLAR_ENVIRONMENT=production`, `NEXT_PUBLIC_APP_URL=https://recapai.dev`,
      `BETTER_AUTH_SECRET` freshly generated, `NEXT_PUBLIC_STORE_URL` left empty until step 6.
- [ ] **P** Run `pnpm db:migrate` against the production database.
- [ ] **P** Deploy. Confirm `https://recapai.dev` loads, `/sign-in` signs in with Google, `/pricing`
      lists both plans, `/account` shows the signed-in user.

## 3. Extension changes before the store build

- [ ] **C** Onboarding: lead with "Try Recap Pro free" and put "Use my own key" second.
- [ ] **C** Welcome page opened once on install (`runtime.onInstalled`, reason `install`).
- [ ] **C** Uninstall survey URL (`runtime.setUninstallURL`) pointing at a short form on recapai.dev.
- [ ] **C** Review prompt: once, after the third successful summary, linking to the store review page.
- [ ] **C** Implement the Pro screen redesign from Claude Design (when Paolo hands it over; can
      ship after launch if it is not ready).
- [ ] **C** Bump the version to 2.1.0 in `package.json` and `wxt.config.ts`; update the changelog.
- [ ] **P** Set the GitHub repo variable `WXT_PRO_ORIGIN=https://recapai.dev` on `PaoloJN/recap`.
- [ ] **C** Tag `v2.1.0`, let `release.yml` build the zips, download the Chrome zip from the release.
- [ ] **P** Load the release zip unpacked in Chrome and run the manual checklist in
      `docs/superpowers/notes/2026-10-26-v3-manual-test-checklist.md` plus Pro sign-in against production.

## 4. Store listing assets

- [ ] **P** Chrome Web Store developer account ($5 one-time), publisher name and verified contact email.
- [ ] **P/C** Title (keyword first, e.g. "Recap AI: YouTube Summary, Transcript & Chat"), short
      description (132 chars), and full description written from the roadmap positioning.
- [ ] **P** 5 screenshots at 1280x800: summary, transcript search, chat, settings/providers, Pro.
      Make them in Claude Design using the `claude-design-graphic` brief.
- [ ] **P** Small promo tile 440x280 and marquee 1400x560 (optional but needed for the Featured badge).
- [ ] **P** 30-second demo video uploaded to YouTube, unlisted is fine.
- [ ] **C** Privacy policy at `recapai.dev/privacy` covers both modes: keys stay local for BYOK; for
      Pro, the transcript and chat messages go to recapai.dev and the model provider, what is
      stored (account, usage counts, device keys) and for how long. Terms mention refunds and cancellation.
- [ ] **P** Store privacy disclosures: single purpose statement, justification for `storage` and each
      host permission, "remote code: no", data usage checkboxes matching the policy, certify.

## 5. Submit

- [ ] **P** Upload the Chrome zip, fill the listing, set visibility Public, submit for review.
      Reviews take about 1 to 7 days; permissions and the privacy form are what get rejected.
- [ ] **P** While waiting: submit the Firefox zip to addons.mozilla.org (optional, same assets).

## 6. After approval

- [ ] **P** Set `NEXT_PUBLIC_STORE_URL` on Vercel to the store listing and redeploy. The landing
      page's "Coming soon" button becomes "Add to Chrome".
- [ ] **C** Put the store link in the README and the GitHub repo description.
- [ ] **P** End-to-end on production with a real card: install from the store, sign in, use up the
      trial, pay, confirm Pro unlocks in the panel, cancel in Polar, confirm the downgrade.
- [ ] **P** Set up the Polar payout account so money can actually leave Polar.
- [ ] **P** Monitoring: Vercel runtime error alerts to email; a weekly look at installs, trials and
      paid in Polar and the store dashboard.

## 7. First week after launch (from the roadmap, not blocking)

- [ ] Free transcript tool page on recapai.dev (main SEO bet).
- [ ] One tutorial video and three Reddit or Quora answers per week.
- [ ] Server-side summary cache and a remote kill switch for transcript fetching.
