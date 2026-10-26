# YouTube AI panel v3: redesign on top of the v2 rebuild

Date: 2026-10-26. Owner: Paolo Nessim. Status: awaiting owner approval.

## Intent

Paolo redesigned the panel in Claude Design and handed over a high-fidelity reference:
`docs/design/v3-handoff/` (README, `globals.css` theme, logo SVGs, an interactive HTML
prototype of every state). This spec turns that handoff into a buildable description for
the existing v2 codebase on branch `v2` (WXT, React 19, Tailwind v4, shadcn, AI SDK 7).

The handoff README is the visual source of truth: layout, spacing, type sizes, copy and
interactions. This document decides **what of the handoff gets built**, how it maps onto
the current architecture, and settles everything the handoff leaves open. Where this doc
and the handoff disagree, this doc wins; the disagreements are listed in "Scope rulings".

Read first: `docs/design/v3-handoff/README.md`, then `docs/design/v3-handoff/globals.css`,
then the prototype template/logic in `docs/design/v3-handoff/prototype/extracted/` for exact
copy, sample data and behaviour. Open `prototype/All States.dc.html` in a browser to see it.

## Goals

- The shipped panel matches the handoff closely enough that a side-by-side with the
  prototype shows the same layout, colours, type and copy in dark and light.
- Keep everything v2 already does working: InnerTube transcript + DOM fallback, streaming
  over the background port, three providers, per-video chat history, timestamp seeking.
- Add the features the design depends on and that are cheap to do well: OpenRouter, chapter
  bar, key validation, structured summary, usage counters, auto-summarize, filler-word
  stripping, text size, theme override, answer language, export, in-page shortcuts.
- Transcript tab works without an API key.

## Non-goals

- Pixel-perfect parity with the prototype's inline-styled HTML. Use Tailwind classes and
  shadcn primitives; match the numbers in the README.
- Supporting pages other than `/watch`. The panel is still mounted only in the watch page
  sidebar.
- Cost accounting in dollars. Token counts yes, prices no (they go stale).

## Anti-goals

- Faking any state. No placeholder "generated" suggestions, no fake progress, no "I'll use
  that to tune the prompt" when nothing is tuned. Every element on screen is backed by real
  behaviour or is cut.
- Any network call other than YouTube and the chosen provider. No telemetry, no server.
- Loading the transcript (InnerTube or DOM panel) or calling an LLM while the card is
  collapsed. Fetching the watch page itself (title, channel, chapters, caption track list) is
  fine while collapsed: it is one same-origin GET and touches no YouTube UI.

## Scope rulings (handoff items changed or cut, with reasons)

These are the controller's calls. Paolo can veto any of them.

| Handoff item | Ruling | Why |
|---|---|---|
| "Transcribe audio" button + progress (Summary and Transcript no-captions states) | **Cut.** No-captions states keep the tile, heading and body copy; body copy becomes "Summaries and chat need captions. Search, follow and jump still work on videos that have them." No button. | Needs audio extraction from YouTube's stream plus an upload to a speech API. Large, fragile, out of "small polish" scope. |
| Usage: "$0.41", spend bar, "$1/$5/$20/Off" monthly limit, "Pauses requests when reached" | **Cut the dollar parts.** Keep "This month" with `N tokens · N summaries · N chats` and "Resets <1st of next month>". Footnote: "Counted from the token usage your provider reports." | Prices change; a wrong estimate is worse than none. Token counts are real (AI SDK `usage`). |
| Model lists (GPT-5 mini, Claude Sonnet 4.5, Gemini 2.5 Flash…) | **Replace** with the verified catalogue below. Any menu that lists models lists the current provider's models. | Design used placeholder names. |
| Separate summary model vs chat model pickers | **One current model** per provider (`settings.models[provider]`). The Options menu and the composer picker both change it. | One mental model; the design's two pickers would otherwise disagree silently. |
| "Custom prompt…" in the Options menu | **Keep** as "Custom instructions…" → opens Settings → Summaries → "Custom instructions" textarea, appended to every summary prompt. | Cheap, useful. |
| Follow-up suggestions under the last assistant reply | **Cut.** | Would need a second model call or a parsed trailer on every answer. Flicker and cost for little gain. |
| Chat start suggestions "generated per video" | **Keep, sourced from the summary.** The Detailed/TL;DR summary prompt asks for a `## Questions` section with three questions; when a summary exists for this video they are the three suggestion rows, otherwise the three static ones from the prototype. | Real per-video suggestions with no extra call. |
| "Explain what's happening at mm:ss" row | **Keep.** Quotes the active transcript line and sends "Explain what's happening here." | |
| Quick-action chips: Explain simply, Quiz me, Study notes (the prototype also has a 4th "Find a moment" that only prefills a draft) | **Keep the three**; "Find a moment" cut. | Matches the README. |
| Thumbs up/down on the summary | **Keep**, stored with the cached summary, no network. Toasts: "Thanks, noted" for both. | Honest copy. |
| More menu: "Open in side panel" | **Cut.** | Side panel is a separate surface; not in scope. |
| More menu: "Export as Markdown" | **Keep**: downloads `<video title>.md` with the summary (if any) and the chat (if any). | |
| More menu: "Keyboard shortcuts" (kbd `?`) | **Keep**: opens Settings scrolled to the shortcuts section. No `?` shortcut. | |
| More menu / footer: "Send feedback", "What's new", "Privacy" | **Keep** as links: GitHub issues, `CHANGELOG.md` on GitHub, README "Privacy" section. | |
| Settings → Appearance → Font (Roboto / Geist) | **Cut the row.** Roboto only (YouTube loads it). Roboto Mono is bundled, see "Fonts". | A font setting is not worth a second bundled family. |
| Keyboard shortcut `/` for "Focus chat" | **Replaced by ⌥C.** | `/` is YouTube's own search shortcut. |
| Auto-summarize default | **Off.** | Bring-your-own-key: no call the user did not ask for. The prototype defaults on. |
| Settings → Data → "Export chats (Markdown, one file per video)" | **Keep** as one file: "Export chats · Markdown, all videos in one file". | One download, not twenty. |
| Settings stored in `chrome.storage.sync` | **Keep `local`** for everything. | One device, no quota surprises. |
| Toggle shortcut ⌥Y | **Keep**: manifest command `toggle-panel` suggested key becomes `Alt+Y`. | Matches the design. |
| "No video" view | **Cut.** The panel is not mounted off `/watch`. | Non-goal above. |
| "Earlier chats" list on the chat start screen | **Cut** (it is in the prototype logic but not in its template either). | Single thread per video. |
| Summary API error: "I'll retry in 5s" auto-retry | **Cut the auto-retry.** Body copy: `<mapped error>. Retry, or switch to another model.` Buttons stay: "Retry now", "Switch model" (opens the Options menu). | The error mapper already does one quick retry. |
| Streaming summary while "Generating" | Steps card + skeleton until the first token, then the live, progressively parsed summary replaces both. | The design shows a skeleton only because the prototype can't stream. |
| Collapsed status row copy "Summary ready · 5 key moments" | **Keep**, with real states (table in "Collapsed"). | |
| Panel height 640px expanded | **Keep** (`height: 640px`, auto when collapsed). | |

## The product, as it will ship

Everything below follows the handoff README unless noted. Numbers (padding, sizes, radii)
are in the README; copy is in the README and `prototype/extracted/logic.js`.

### Shell

- Mounted as today: shadow root `youtube-ai-panel`, first child of `#secondary-inner`,
  `isolateEvents`, `autoMount`. Card: `background` bg, 1px `border`, radius 12px, width
  100% of the column, height 640px open / auto collapsed, `overflow: hidden`, flex column.
- Header, chapter bar, tab row, body, toast as in the README "Layout skeleton".
- Header icon buttons: Settings, More (dropdown), Collapse/Expand. Clicking the title area
  expands when collapsed. Play/pause glyph reflects the real `<video>` paused state;
  `mm:ss` is the live playback time (one `timeupdate` subscription shared by the whole
  panel, throttled as today).
- Chapter bar: segments from `chapters` (below). Without chapters: one segment for the whole
  video. Clicking seeks to the chapter start and toasts "Jumped to mm:ss". Tooltip
  `Chapter · mm:ss` via the `title` attribute.
- Tab row: three chips. Right side: Summary → Regenerate + Options dropdown; Chat with
  messages → "New". Transcript → nothing.
- Toast: one at a time, bottom-left, 1.8s, `primary` bg.
- Settings view replaces the header with ← back, "Settings", version from the manifest.
  Chapter bar and tab row are hidden in Settings and in the BYOK connect view.
- Theme: `settings.theme` `youtube | dark | light`; `youtube` follows the `dark` attribute
  as today. The `dark` class goes on the app wrapper and the shadow container (portals).
- Text size: `settings.textSize` `s | m | l` sets CSS variables on the wrapper
  (`--text-body/--leading-body` 13/19, 14/21, 16/24; `--text-lead/--leading-lead` 14/21,
  15/23, 17/26). Body text and summary lead use them; chrome (header, tabs, menus) does not.

### Collapsed

Header + chapter bar + one status row (`check-circle` icon only when green):

| State | Row text | Icon |
|---|---|---|
| No key for the current provider | "Add a key to get started" | `key` |
| Transcript unavailable | "No captions on this video" | `closed-captioning` |
| Transcript error | "Couldn't load the transcript" | `warning-circle` |
| Summary done | "Summary ready · N key moments" (or "Summary ready" for TL;DR) | `check-circle` in `success` |
| Summary streaming | "Summarizing…" | spinner |
| Otherwise | "Ready to summarize" | `sparkle` |

Right side shows `⌥ Y`. Clicking the row expands.

### Views

`view: main | settings | onboarding`. `main` shows the tab body. `onboarding` is the BYOK
connect screen. There is no separate "no key" view: the Summary and Chat tabs render the
no-key gate when the current provider has no key; the Transcript tab always renders.

### Summary tab

States `idle | loading | done | error` plus transcript `unavailable | error` which render
the no-captions / error states.

- **Idle** (auto-summarize off, or on but no cached summary yet and auto-summarize off):
  "Summarize this video", `"{N} transcript segments, {m:ss} long. Takes about {est} with
  {model}."` where `est` is a rough label from transcript size (under 20k chars "5s", under
  60k "10s", else "20s"), "Generate summary" (`sparkle`), "Just chat", hint line.
- **Auto-summarize on**: generation starts as soon as the transcript is ready and the card is
  open, once per video (cached).
- **Loading**: steps card "Fetching transcript → Reading N segments → Writing summary".
  Step 0 active while the transcript loads, step 1 active from request start until the first
  text delta, then the card and skeleton are replaced by the live summary.
- **Done**: layout per README. Rendered from the parsed structure (below). Current moment =
  last moment whose time ≤ playback time. Footer: "Useful?" thumbs, copy (toast "Copied as
  Markdown"), spacer, "Ask a follow-up" → Chat tab with draft "Explain {first key moment
  text} in more detail" (or "Tell me more about this video" if no moments). Meta line
  `Model · Style · Language` where Language is the answer-language setting, or the
  transcript language label when "Match video".
- **Error**: `danger-soft` box per README with the ruling above.
- **Options dropdown** (shadcn `DropdownMenu`, portal into the shadow container): Style group
  (Detailed / TL;DR / Key moments with the prototype notes), Model group (current provider's
  models with a one-line note each, from the catalogue), "Custom instructions…". Picking a
  style regenerates; picking a model does not.
- Regenerate always re-requests, replacing the cache.

**Summary format and parsing.** The prompt asks for Markdown in this exact shape so the UI
can render the design's sections while streaming:

```
<lead paragraph(s)>

## Key moments
- m:ss Text
- m:ss Text

## Notes
- Text

## In plain terms
<one short paragraph>

## Questions
- Question?
- Question?
- Question?
```

Styles: `detailed` asks for all sections; `tldr` asks for lead + Questions only (2–3
sentences); `moments` asks for Key moments only (and Questions). `parseSummary(text)` is a
pure function returning `{ lead, moments: {seconds, text}[], notes: string[], plain, questions:
string[] }` from a possibly incomplete stream; unknown headings fall into `lead`. The copied
Markdown is the raw model text minus the Questions section. The cache stores
`{ style, model, text, feedback?, createdAt }` per video id.

### Transcript tab

Per README: toolbar (search with match cluster, Follow toggle, copy), list with chapter
headers and lines, hover pill (Ask / Copy), follow behaviour with "↓ Back to mm:ss", search
highlights with current match in `warning`, Esc/Enter/Shift+Enter keys.

- Works with no API key.
- Lines are the v2 merged blocks (12 000 ms), not raw segments; chapter headers are inserted
  before the first line whose start ≥ chapter start.
- "Remove filler words" strips `um`, `uh`, `you know` with adjacent commas (prototype regex)
  from display, copy and quotes. It does not change what is sent as transcript context.
- Copy transcript: "Transcript copied with timestamps", lines as `m:ss text`.
- Ask on a line → Chat tab with that line quoted in the composer.
- Follow default comes from settings; a user wheel/touch scroll turns it off for this video
  until "Back to mm:ss" or the toggle.

### Chat tab

Per README: start screen, messages, composer. Built on `useChat` with the existing
`PortChatTransport`; message rendering is custom (not AI Elements bubbles).

- User message `metadata`: `{ at?: seconds, quote?: { seconds, text } }`. The text sent to the
  model is the typed text, with the quote prepended as `> [m:ss] text` and the "at" as
  `(asked at m:ss)`; the bubble shows them as designed.
- Assistant text renders through the existing Markdown component with timestamps turned into
  citation chips (`play` icon + `m:ss`) instead of links. Actions: copy, regenerate (last
  reply only), thumbs-up (visual, stored in the message metadata).
- Streaming: dots until the first delta, caret while streaming, Send becomes Stop. Stopping
  keeps the partial text and appends "Stopped." under it.
- Composer: quote row, 2-row textarea, model picker (opens upward), "Current moment" toggle →
  `at mm:ss ×` chip, Send/Stop. ⏎ sends, ⇧⏎ newline.
- "New" clears this video's thread (no confirm; the design has none).
- Start screen rows and chips as ruled above. Starter suggestions from the summary's
  Questions when available.

### No-key gate (Summary and Chat tabs)

Per README. "Add API key" → onboarding view. "Open transcript" → Transcript tab. The
`coins` row reads "Pennies per summary · A 10-minute video is a few thousand tokens" (no
dollar figure).

### BYOK connect (onboarding)

Per README. Provider rows (OpenAI "Most used", Anthropic "Long videos", Google AI "Free
tier", OpenRouter "One key, 300+ models") with the model names from the catalogue. Key field
with show/hide and Paste (`navigator.clipboard.readText`, falls back to focusing the input if
denied). "Get a key ↗" opens the provider's key page.

Validation runs in the **background** (host permissions) via `validateKey(provider, key)`:

| Provider | Request |
|---|---|
| openai | `GET https://api.openai.com/v1/models`, `Authorization: Bearer` |
| anthropic | `GET https://api.anthropic.com/v1/models`, `x-api-key`, `anthropic-version: 2023-06-01`, `anthropic-dangerous-direct-browser-access: true` |
| google | `GET https://generativelanguage.googleapis.com/v1beta/models`, `x-goog-api-key` header (never the `?key=` query) |
| openrouter | `GET https://openrouter.ai/api/v1/auth/key`, `Authorization: Bearer` (verified 2026-10-26: `/models` answers 200 even for a bad key, `/auth/key` answers 401). Model list for the chips comes from the public `GET https://openrouter.ai/api/v1/models` |

Result `{ ok: true, models: string[] }` (ids) or `{ ok: false, status, message }`. The UI shows
"Key works. N models available." and chips for the catalogue models present in the list
(all catalogue models if the list can't be matched). Rejected → "{Provider} rejected this key
({status})". Network failure → "Couldn't reach {Provider}. Check your connection." Saving
stores the key and sets `settings.provider`.

Entry points: no-key gate, Settings → API key → "Replace", and first open with no key for
the current provider when the user is on Summary/Chat (the gate, not onboarding, is shown
first; onboarding is one click away).

### Settings

Sections per README with these changes: Usage per the ruling; Appearance has Theme and Text
size only; Summaries adds "Custom instructions" (textarea, 500 chars max) and Auto-summarize
defaults **off** (BYOK: no call the user did not ask for); Keyboard shortcuts lists Toggle
panel ⌥Y, Focus chat ⌥C, Summarize video ⌥S, Search transcript ⌥F; Data has
Export chats and Clear chat history (shadcn `AlertDialog`); footer links per ruling.
Removing a key: the API key row gets a "Remove" action next to "Replace" (the design implies
it under "Remove it anytime in settings").

### Keyboard

- Manifest command `toggle-panel`, suggested `Alt+Y`.
- In-page (content script keydown on `document`, matched on `e.code` because macOS turns
  Alt+letter into a different `e.key`; ignored when focus is in an editable element outside
  the panel): `Alt+C` focuses the chat composer (opens the card, switches to Chat); `Alt+S`
  opens the card and starts a summary; `Alt+F` opens the card, switches to Transcript and
  focuses search. The design's `/` is **not** used: YouTube binds `/` to its search box and
  taking it over would remove a native shortcut. Settings lists ⌥Y, ⌥C, ⌥S, ⌥F.

### Chapters

`chapters: { seconds, title }[]` parsed from the watch page HTML's `ytInitialData`
(`playerOverlays.playerOverlayRenderer.decoratedPlayerBarRenderer.decoratedPlayerBarRenderer
.playerBar.multiMarkersPlayerBarRenderer.markersMap[]` with key `DESCRIPTION_CHAPTERS`, else
`AUTO_CHAPTERS`; each `value.chapters[].chapterRenderer` gives `title.simpleText` and
`timeRangeStartMillis`). Fallback: lines in the description matching `^(\d{1,2}:)?\d{1,2}:\d{2}\s+(.+)$`
when there are at least two and the first is 0:00. Empty array when neither applies. Parsed
by `parseWatchPage` alongside the existing fields, pinned with a fixture.

### Providers and models

Catalogue (first three verified 2026-10-25, OpenRouter 2026-10-26):

- openai: `gpt-6-luna` (default) "Fast. Good for summaries", `gpt-6.1-sol` "Slower. Better
  reasoning", `gpt-6-astra` "Cheapest"
- anthropic: `claude-haiku-5-5` (default) "Fast", `claude-sonnet-5-5` "Best on long videos",
  `claude-opus-5-5` "Strongest reasoning"
- google: `gemini-3.8-flash` (default) "Fastest", `gemini-3.5-flash-lite` "Cheapest",
  `gemini-3.1-pro-preview` "Deepest"
- openrouter (ids verified against the public model list 2026-10-26): `openai/gpt-6-luna`
  (default) "Fast. Good for summaries", `anthropic/claude-sonnet-5.5` "Best on long videos",
  `google/gemini-3.8-flash` "Fastest". Provider via `@openrouter/ai-sdk-provider` (peer `ai
  ^7`). Host permission `https://openrouter.ai/*`. Key URL `https://openrouter.ai/settings/keys`.

Settings migrate: a stored `Settings` missing new fields is merged over `DEFAULT_SETTINGS`.

### Usage counters

Background records, per request that finishes (not aborted before any token): the
`streamText` result's `totalUsage.inputTokens + outputTokens` (0 when the provider reports
none) into `local:usage` → `{ [YYYY-MM]: { tokens, summaries,
chats } }`. Settings shows the current month. Older months are pruned beyond two.

### Export

`exportVideoMarkdown(video, summary?, chat?)` and `exportAllChats(store)` are pure functions
returning strings; a tiny helper downloads a Blob with an `<a download>` click. Filenames:
`<title slug>.md` and `youtube-ai-chats.md`.

### Fonts

Roboto comes from YouTube's page and is usable inside the shadow root. Roboto Mono is not
loaded by YouTube, and every timestamp, kbd and key mask in the design uses it, so it ships
with the extension: Latin subset, weights 400 and 500, as woff2 in `public/fonts/`, listed in
`web_accessible_resources`, declared with `@font-face` in a `<style>` the content script
appends to the page `<head>` (font faces must live in the document, not the shadow root).
Geist stays cut.

### Icons and logo

Switch to `@phosphor-icons/react` (regular weight; `fill` for play, pause, stop,
check-circle, warning-circle, sparkle per the prototype). Remove `lucide-react` once no
file imports it. Logo: the four-path mark from `docs/design/v3-handoff/assets/`, inlined as a
React component with `fill="currentColor"`. Extension icons `public/icon/*.png` regenerated
from the mark: white mark on a `#0f0f0f` rounded square (radius 22% of the size) at 16, 32,
48, 96, 128. The generator script lives in `scripts/` and is run once; the PNGs are committed.

### Architecture notes (what changes in v2's structure)

- `src/assets/tailwind.css`: replace the oklch shadcn defaults with the handoff `globals.css`
  tokens, keeping `:root, :host` selectors, the existing `@custom-variant dark`, the
  Streamdown `@source`, and adding the `@theme inline` extras (`--color-link`, `-link-soft`,
  `-success(-soft)`, `-warning(-soft)`, `-danger-soft`, `-subtle-foreground`, `-progress`,
  `--shadow-pop`, `--ease-out`, fonts).
- `useVideo` splits in two: the watch-page fetch (metadata, chapters, `captionTracks`)
  runs on every video id change regardless of `open`; the transcript fetch runs only while
  `open` is true (never gated on the key). "No captions" is known from an empty
  `captionTracks` before the transcript is ever fetched, so the collapsed row and the header
  title/chapter bar are right on first paint.
- A `usePlayer` hook exposes `{ ms, paused }` from one shared subscription.
- Port protocol gains request kinds `validate-key` (one-shot, reply `{type:"key-result"}`) and
  keeps `chat` / `summary`. Summary requests carry `{ style, customInstructions, language }`.
- Storage items: `settings` (expanded), `apiKeys`, `panel` (`open`, `tab`), `chats`,
  `summaries` (`local:summaries`, per video, cap 20 like chats), `usage`.
- Streamdown stays for Markdown; its link renderer maps `#t=` hrefs to citation chips.
- AI Elements components that end up unused are deleted (the design's bubbles and composer
  are custom). `use-stick-to-bottom` may stay for the chat scroll.
- Unit tests for every pure function introduced (`parseSummary`, chapters parsing, filler
  stripping, export builders, usage accounting, settings migration, key-result mapping,
  collapsed-row state) and React tests where v2 already has them (Markdown chips).

### Repo hygiene

- Work on branch `v2` (unmerged). Tag `v2-pre-redesign` first.
- `CHANGELOG.md` 2.0.0 entry rewritten to describe what ships (it is unreleased).
- README feature list, screenshot reference and privacy section updated. Screenshot still
  Paolo's.
- Manual test checklist rewritten for v3 at `docs/superpowers/notes/2026-10-26-v3-manual-test-checklist.md`.
- Paolo tests in Chrome himself; agents verify with `pnpm check`, `pnpm typecheck`,
  `pnpm test`, `pnpm build` only. No browser automation.

## Decisions settled after the builder check

1. Watch-page fetch runs while collapsed; transcript fetch and LLM calls do not (see
   Anti-goals and Architecture notes).
2. `/` dropped in favour of ⌥C; shortcuts matched on `e.code`.
3. Roboto Mono is bundled (see Fonts).
4. Auto-summarize defaults off.

## Left to the builder

- Exact Tailwind class choices and component decomposition.
- Whether to keep `ai-elements/conversation.tsx` for stick-to-bottom or use the hook directly.
- The `est` thresholds and the exact phrasing of the "Custom instructions" placeholder.
- How the DropdownMenu "opens upward" for the composer model picker (Radix `side="top"`).
- Test fixture sources (a saved watch page with chapters; may be fetched with curl once and
  trimmed).
