# Recap Pro: sign in through a normal tab

Status: approved in chat by Paolo on 2026-10-30. Replaces the `launchWebAuthFlow` popup in
`2026-10-27-recap-pro-design.md` ("Connect" section). Everything else in that spec stands.

## Why

The sign-in popup window feels foreign. Paolo wants sign-in to look like any other product: a
normal tab on recapai.dev, sign in however you like, pick a plan or skip it, and land back on the
video you were watching. Easy for the user beats clever.

## The flow (what the user sees)

1. **Recap panel → Sign in.** A normal tab opens on `recapai.dev/sign-in`. The panel shows
   "Finish signing in in the other tab" with "Open it again" and "Cancel".
2. **Sign in.** Google today. More providers come later and must slot in without changing this
   flow.
3. **Pick a plan** (`/connect`). Users who aren't on Pro see Monthly and Yearly, and a small
   "Continue without a plan" link in the corner. Users already on Pro skip the picker and get one
   "Back to your video" button.
4. **Done.** Recap closes the sign-in tab and brings the original YouTube tab to the front,
   signed in (and on Pro if they paid). If that doesn't happen within ~2 s (e.g. they closed the
   YouTube tab), the website opens the video itself in that tab, at the timestamp they left.
5. A plan pick goes through Polar checkout first; the success page finishes step 4.

## Decisions

- **Separate sessions, same account.** Website session (cookie) and extension (per-device key)
  are independent. Signing out of the website does not sign out the extension; signing out in
  Recap disconnects only that browser. The account page lists connected browsers (exists) and
  gains **"Sign out everywhere"**, which revokes every device key and every web session. Plan
  changes reach the extension through `/api/v1/me` as today.
- **Return link.** The extension passes the current video URL (with `t=<seconds>`) as
  `return`. The website accepts only `https://` YouTube watch/shorts/youtu.be URLs on
  `youtube.com`, `www.youtube.com`, `m.youtube.com`, `youtu.be`; anything else is dropped (no
  open redirect).
- **Handing the login to the extension: a one-time link code with a secret (PKCE style).**
  - The extension makes a random `verifier` (32 bytes, base64url) and
    `challenge = base64url(sha256(verifier))`, then `POST /api/v1/link {challenge, browser}`
    returns a server-made `code` (32 random bytes, base64url). Only `code` goes in the tab URL.
  - When the user confirms on the website (any of: "Back to your video", "Continue without a
    plan", picking a plan), the site approves the link for the signed-in user.
  - The extension polls `POST /api/v1/link/claim {code, verifier}` about every 1.5 s. The first
    claim after approval mints the device key (same name, TTL and rate limit as today) and
    returns it exactly once.
  - A leaked tab URL is useless without the verifier, which never leaves the extension except
    in the claim body.
  - **The confirm click is the anti-phishing step.** Someone who sends a victim their own link
    gets nothing unless the victim clicks a button on a page that names their account. So the
    site never approves a link without a click.
- **The tab closes only when the website says the flow is finished.** "Back to your video" and
  "Continue without a plan" approve and finish together. A plan pick approves first, so the
  extension is signed in while the user is in checkout, and finishes on the checkout success
  page. The extension closes the tab when it has the key and the link is finished.
- **Remove the popup path entirely.** That means `/extension/connect`, `/api/extension/token`,
  `EXTENSION_REDIRECT_ALLOWLIST`, the extension's `identity` permission and
  `launchWebAuthFlow`. Nothing is released, so there is no migration. A Pro build then adds
  **no** permissions: `tabs.create`/`tabs.update`/`tabs.remove`/`windows.update` need none, and
  the background never reads tab URLs.
- **Upgrade from the panel** opens `/connect?return=<video>` without a link code: the same plan
  picker, already signed in, and the success page offers "Back to your video". No auto-close
  here; the panel's existing upgrade polling still flips it to Pro.

## Link lifecycle (server)

- `extension_link` row:
  - `code` (PK)
  - `challenge`
  - `browser`
  - `user_id` (null until approved)
  - `approved_at`
  - `finished_at`
  - `claimed_at`
  - `created_at`
  - `expires_at` (created + 30 min)
- Expired rows are useless. Creation deletes expired rows opportunistically.
- **Approve:** once, same-origin, web session required, link not expired. Re-approving by the
  same user is a no-op success; another user gets 409.
- **Finish:** same-origin, the approving user only. Idempotent.
- **Claim:** the verifier must hash to `challenge` (constant-time compare). The response is one
  of:
  - `{status:"pending"}` before approval.
  - `{status:"approved", key, finished}` on the first claim after approval, which mints the
    key and sets `claimed_at`.
  - `{status:"claimed", finished}` after that.
  - `410 expired` once the link has expired.
  - 400/404 for a bad or unknown code or verifier, without saying which.

  CORS `*` like the rest of `/api/v1`.

## Extension behaviour

- **Background holds the flow state** in `storage.session` (it survives an MV3 worker restart):
  `{code, verifier, signInTabId, sourceTabId, expiresAt, key?}`. Starting a new sign-in replaces
  any pending one.
- **The panel drives polling.** While its waiting state is mounted, the panel sends
  `pro-link-poll` every 1.5 s, and the background does one claim per message. This avoids timers
  in an MV3 worker that can die.
  - When the key arrives, it is stored as today and the panel switches to Recap Pro.
  - When `finished`, the background removes the sign-in tab and focuses the source tab and its
    window, ignoring errors if either is gone. Then it clears the flow.
- **"Open it again"** re-focuses the sign-in tab, or reopens the same URL if it's gone.
  **"Cancel"** clears the flow. On expiry the panel shows "Sign-in timed out. Try again."
- **Copy:** the button says "Sign in" (not "Continue with Google"), since providers will vary.

## Not in scope

- More sign-in providers (later).
- The visual redesign of the Pro screens (Paolo is doing it in Claude Design). The new waiting
  state uses the existing `GateLayout`.
