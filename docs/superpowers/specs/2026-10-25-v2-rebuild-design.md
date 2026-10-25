# YouTube AI Extension v2: ground-up rebuild

Date: 2026-10-25
Status: builder check done, owner answered the open question; pending final approval

## Intent

This repo (665 stars, 70 forks) is a Chrome extension that injects a
Summary / Transcript / Chat panel into the YouTube watch page and talks to
an LLM with the user's own API key. The code is from 2023-2024, built on
Plasmo (unmaintained), OpenAI-only, and no longer works on the current
YouTube layout. It does not build cleanly today: two files import modules
that do not exist (`@/lib/supabase`, `llm` from `@/utils/llm`).

The owner wants a "2026 version" to show on a resume: same product, modern
stack, clean code, better UI polish, and a few small features. Not a
feature expansion. Rebuild from scratch in this repo, replacing the old
source entirely.

## Goals

1. Works on the current YouTube watch page, including SPA navigation
   between videos without reload.
2. Modern, maintained stack a 2026 reviewer recognises: WXT, React 19,
   TypeScript strict, Tailwind v4, shadcn, Vercel AI SDK v7 + AI Elements.
3. Bring-your-own-key with three providers: OpenAI, Anthropic, Google.
4. Same three panels and same placement as today, visibly more polished.
5. Four small features (listed below).
6. Repo hygiene that reads well on GitHub: README, CI, tests, releases.

## Non-goals

- No backend, no accounts, no Supabase, no telemetry.
- No Chrome Web Store submission in this pass (keep it possible later).
- No Firefox/Safari builds (WXT makes it cheap later; do not spend time on it).
- No redesign of the UI structure. Keep the layout; the owner may restyle later.
- No local models (Ollama) in this pass.
- No i18n.

## Anti-goals (what would make this a failure even if it works)

- Feature creep. If a feature is not in the list below, it is out.
- A README that overpromises again. Describe only what ships.
- Leaking keys: keys never leave the extension except to the chosen
  provider's API. Never log them.
- Breaking on day one because of a YouTube DOM selector. Anchor selection
  must be resilient (see Constraints).

## The product, as it will ship

### Placement and shell

A panel injected at the top of the right-hand sidebar on
`youtube.com/watch` pages (above "Up next"). It is a collapsible card with
a header bar: extension icon, three segmented tabs (Summary, Transcript,
Chat), a settings button, and a collapse toggle. Default collapsed state
on first install: open on the Summary tab. Collapsed state and last-used
tab persist across videos.

The panel follows YouTube's theme (light or dark), detected from
YouTube's own CSS variables / `html[dark]` attribute, and re-detected when
the user toggles YouTube's theme.

### Settings (new, replaces the inline "enter OpenAI key" screen)

A settings view inside the panel (not a separate options page):

- Provider: OpenAI | Anthropic | Google.
- API key per provider (password field, "Save", "Remove"). Stored in
  `browser.storage.local`. Plain storage is acceptable; the old
  "SecureStorage" with a hardcoded password gave no real protection and
  is dropped. The README must say plainly that keys are stored locally in
  extension storage.
- Model per provider, from a short curated list per provider with a
  sensible default. Builder picks the list at build time from the current
  provider catalogues; prefer the cheapest "good" model as default.
- Link to where to get a key for each provider.

If no key is configured for the selected provider, each panel shows an
empty state that points to Settings instead of erroring.

### Summary panel

- Preset selector: TL;DR (short paragraph), Key takeaways (bullets),
  Chapters (timestamped sections). Presets are prompt templates in code,
  not user-editable in this pass.
- "Generate" button (summaries are on demand, not automatic, to avoid
  spending the user's tokens on every video).
- Streams Markdown into the panel. Timestamps in the output (e.g. `12:34`
  or `[12:34]`) render as clickable chips that seek the video.
- Actions: Regenerate, Copy as Markdown.
- The result is cached per video id and preset in memory for the tab
  session, so switching tabs and back does not regenerate.

### Transcript panel

- Transcript chunks with timestamps, grouped into ~10-20 second blocks.
- Search box filters chunks with match highlighting.
- Click a chunk to seek the video to its start.
- The chunk matching current playback time is highlighted and the list
  auto-scrolls to it while following is on. Following pauses when the user
  scrolls manually and resumes via a "Jump to current" button.
- Copy whole transcript (with timestamps) to clipboard.
- Empty state when the video has no captions.

### Chat panel

- Built on AI Elements (Conversation, Message, MessageResponse,
  PromptInput) and `useChat` from `@ai-sdk/react`.
- Suggested starter questions in the empty state (static list, as today;
  no LLM-generated suggestions).
- Streaming responses rendered as Markdown with clickable timestamps.
- Stop generation button while streaming.
- Chat history persisted per video id in `browser.storage.local`
  (cap: keep the 20 most recent videos). "Clear chat" action.
- Transcript plus title/channel/duration is injected as system context.
  For very long transcripts, truncate to a character budget (builder's
  call on the number) and tell the model it was truncated.

### Keyboard

- One shortcut to toggle the panel open/closed, bound via the manifest
  `commands` API (user-rebindable in `chrome://extensions/shortcuts`).
  Default suggestion: `Alt+Shift+Y`. No other hotkeys.

## Architecture

### Stack (decided)

| Concern | Choice | Version at time of writing |
|---|---|---|
| Extension framework | WXT with `@wxt-dev/module-react` | wxt 0.21.x |
| UI | React 19, TypeScript strict | react 19.3 |
| Styling | Tailwind v4, shadcn (new CLI) | tailwindcss 4.3, shadcn 4.x |
| Chat UI | Vercel AI Elements (`npx ai-elements@latest add ...`) | latest |
| LLM | Vercel AI SDK v7: `ai`, `@ai-sdk/react`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google` | ai 7.0.x |
| Lint/format | Biome | 2.x |
| Tests | Vitest | 5.x |
| Package manager | pnpm | |

Why WXT: Vite-based, actively maintained, first-class shadow-root UI and
content-script context handling, auto-manifest, zip packaging. Plasmo is
unmaintained.

Why AI SDK: provider-agnostic streaming with one code path, and AI
Elements gives polished chat UI for free. This is also the honest
differentiator vs YouTube's built-in Gemini: pick your own model.

### Process boundary

LLM calls run in the background service worker, not the content script.
Content-script fetches are subject to YouTube's CORS/CSP and provider
browser-access policies differ; the service worker avoids all of that and
keeps the key out of page context.

Streaming goes over a `browser.runtime.connect` port:

- Content script implements a custom AI SDK `ChatTransport` whose
  `sendMessages` opens a port, posts `{ messages, videoContext, provider,
  model }`, and returns a `ReadableStream<UIMessageChunk>` fed by port
  messages. `reconnectToStream` returns `null`. Closing the stream /
  abort disconnects the port, which the background treats as cancel.
- Background handler builds the model via the provider factory, calls
  `streamText`, converts with the top-level `toUIMessageStream({ stream:
  result.stream })`, and posts each chunk over the port; posts a terminal
  error chunk on failure with a user-readable message (invalid key, rate
  limit, network).
- Summary uses the same port protocol with a different "kind" so there is
  one streaming code path.

### Video data

- Video id from `location.search`. Detect navigation via YouTube's
  `yt-navigate-finish` event (fallback: poll `location.href` every second).
- Metadata (title, channel, duration) from `ytInitialPlayerResponse`.
  The content script runs in the ISOLATED world, so either fetch the watch
  HTML and regex-parse it (known to still work as of 2026-10-25) or read
  the global from a small MAIN-world script. Builder's call.

### Transcript source (decided 2026-10-25, owner approved)

The 2023-era path (caption `baseUrl` from the player response, fetched
with `fmt=json3`) is dead: verified on 2026-10-25 it returns HTTP 200 with
an empty body, because YouTube now requires a proof-of-origin token on
caption requests. Do not build on it.

Primary: call the same internal endpoint that YouTube's own "Show
transcript" button calls, `POST /youtubei/v1/get_transcript`, from the
content script, with the page's own `INNERTUBE_API_KEY` and
`INNERTUBE_CONTEXT` (read from `ytcfg`) and the user's own session
cookies. No client spoofing, no token forging; it is the request the page
already makes for this user. Parse `transcriptSegmentRenderer` entries
into `{ text, startMs, endMs }[]`.

Fallback: if the primary call fails or returns no segments, open
YouTube's transcript engagement panel programmatically and read the
segments from the DOM, then close it again.

The first task in the plan is a short spike that confirms the primary
call works from a content script on the current YouTube, and records the
`params` encoding and response shape as a test fixture.

README must say: transcripts come from YouTube's own transcript feature,
which is undocumented and may change; the extension will degrade to "no
transcript available" if it does.

### Videos without captions (owner emphasised)

Many videos have no captions at all (no manual, no auto-generated), and
some have captions only in a language the user did not pick. Treat
"transcript unavailable" as a normal state, never an error:

- Detect it up front, before any LLM call, from the `get_transcript`
  response (and fallback) returning no segments, or from the player
  response having no `captionTracks`.
- Transcript panel: empty state "This video has no transcript".
- Summary and Chat: same empty state, with the Generate button and the
  prompt input disabled. No API key is spent.
- Still show metadata (title, channel) in the header so the panel does
  not look broken.
- If captions exist in several languages, prefer manual over
  auto-generated, then English, then the first listed. Show the chosen
  language as a small label in the Transcript panel.

### Shadow DOM and styling constraints (known traps, must handle)

- WXT `createShadowRootUi` with `cssInjectionMode: "ui"`.
- Tailwind v4 / shadcn theme variables are declared on `:root`; inside a
  shadow root they must also apply to `:host`. Use `@theme` plus a
  `:host` block, or rewrite `:root` to `:host` in the built CSS.
- YouTube sets `html { font-size: 10px }`. Tailwind `rem` values will
  resolve against that and shrink everything. Either convert rem to px at
  build time (the old code did this, base 12px) or set explicit px-based
  sizing. Pick one and apply it consistently.
- shadcn/Radix components that portal (Select, Tooltip, Popover,
  DropdownMenu) must portal into a container inside the shadow root, not
  `document.body`, or they lose styles. Wrap them once with a
  `container` from context.
- Use WXT `isolateEvents` so typing in the chat input does not trigger
  YouTube's keyboard shortcuts.
- Dark mode is driven by a `dark` class on the shadow root wrapper, not
  `prefers-color-scheme`.

### Source layout (builder may adjust)

```
src/
  entrypoints/
    background.ts            # port handler, provider factory
    youtube.content/         # content script + React mount
  components/
    shell/                   # panel card, header, tabs, settings
    summary/ transcript/ chat/
    ui/                      # shadcn
    ai-elements/             # AI Elements
  lib/
    transcript/              # fetch + parse (pure, tested)
    prompts/                 # system prompt + summary presets (pure, tested)
    providers.ts             # provider/model catalogue + factory
    storage.ts               # typed storage keys (wxt storage helper)
    transport.ts             # ChatTransport over runtime port
    timestamps.ts            # parse/format/seek helpers (tested)
  hooks/
public/icon/
docs/superpowers/specs/
```

### State

Keep it boring: React state and a small number of `wxt/storage`-backed
hooks for settings, panel open/tab, chat history. No Redux, no Jotai.

## Repo hygiene

- Delete all old source (`components/`, `contexts/`, `lib/`, `utils/`,
  `src/`, Plasmo config) in the first commit of the rebuild so there is no
  half-migrated state.
- `README.md` rewritten: one-line pitch, fresh screenshot (owner
  provides or builder captures), features (only what ships), supported
  providers, install from release zip or build from source, privacy note
  on key storage, development, license. Remove the June 2025 banner.
- Keep `LICENSE` as is.
- GitHub Actions: `ci.yml` on push/PR runs `pnpm install`, Biome check,
  `tsc --noEmit`, Vitest, `wxt build`. `release.yml` on tag `v*` runs
  `wxt zip` and attaches the zip to a GitHub Release.
- Tests: transcript parsing, chunking, timestamp parse/format, prompt
  assembly/truncation, provider factory selection. No UI tests in this pass.
- `CHANGELOG.md` with a single v2.0.0 entry.
- Version in `package.json` / manifest: 2.0.0.

## Left to the builder

- Exact model lists per provider and defaults.
- Transcript character budget for the system prompt.
- Chunking granularity for the transcript panel.
- rem-to-px vs px-sizing approach, as long as it is consistent.
- How to read `ytInitialPlayerResponse` (MAIN-world script vs fetch).
- Component-level visual details within the "same structure, more polish"
  brief. Use shadcn defaults; do not invent a design system.
- Whether AI Elements' PromptInput is used as-is or trimmed.

## Decisions settled after the builder check

Owner's answer:
- Depending on YouTube's internal `get_transcript` endpoint, with the DOM
  transcript panel as fallback: approved. No-captions videos must be
  handled as a normal state (see above).

Builder-check items settled by the author (not owner decisions):
- Work on a `v2` branch. Tag the old tree `v1-legacy` before deleting it.
  Merge to `main` once the rebuild builds and the README is updated, so
  `main` never shows a half-rebuilt repo.
- Summary and Chat share the Transcript panel's no-captions empty state.
- Output language: summaries follow the transcript language; chat follows
  the language of the user's message. One line in the prompt templates.
- No free-text custom model field, despite the risk of the curated list
  going stale. Out of scope by the feature list.
- Verify published package versions and the exact AI SDK / AI Elements API
  names at kickoff; the versions in this document are from 2026-10-25.
