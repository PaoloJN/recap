# Handoff: YouTube AI panel (Chrome extension)

## Overview
A panel injected into the YouTube watch page (top of the right-hand column, above recommendations). It lets the user summarize the current video, read/search a transcript synced to playback, and chat with the video. Answers cite timestamps that seek the player. It's **BYOK**: the user brings their own OpenAI / Anthropic / Google AI / OpenRouter key.

## About the design files
The files in `prototype/` are **design references built in HTML**. They show the intended look and behavior; they aren't production code. Rebuild them in the extension's stack: **React + Tailwind v4 + shadcn/ui (latest) + Phosphor icons**. Open `prototype/All States.dc.html` in a browser to see every state side by side (dark + light). Every frame is interactive. `prototype/YT Panel v3.dc.html` is the single component; its `scenario` prop jumps to any state.

## Fidelity
**High-fidelity.** Final colors, type, spacing, copy and interactions. Match them closely, using shadcn primitives where they exist.

## Where it lives
- Panel width = YouTube's secondary column (≈402px; fluid, min 300px). Height 640px when expanded, auto when collapsed.
- Render inside a **shadow root** so YouTube's CSS can't leak in.
- Theme: follow YouTube. `document.documentElement.hasAttribute('dark')` → `.dark`, else `.light`. Observe that attribute with a MutationObserver. Settings → Theme can override it.
- Font: Roboto, to match YouTube. Settings offers Geist as an alternative.

---

## Layout skeleton (top → bottom)
1. **Header** (`padding: 12px 8px 12px 16px`, `gap: 12px`)
   - Logo 22px in a 32px box, `currentColor` = foreground (`assets/logo-*.svg`)
   - Title: video title, 14/20 medium, `foreground`, single-line ellipsis
   - Meta: play/pause icon 10px · `mm:ss` (Roboto Mono 11px) · channel name; 12/16, `muted-foreground`
   - Icon buttons, 32px circles, ghost: Settings (`gear-six`), More (`dots-three-vertical`), Collapse (`caret-up` / `caret-down`)
2. **Chapter progress bar** (`padding: 0 16px 8px`, `gap: 3px`). One segment per chapter, `flex` proportional to its length. Track is 3px tall, radius 2px, `muted`. Fill is `progress` (#ff0033). Each segment has a 4px vertical hit area; clicking it seeks to the chapter start; the `title` tooltip shows chapter name · time.
3. **Tab row** (`padding: 0 10px 12px 16px`, `gap: 8px`, bottom border)
   - YouTube-style chips: 32px tall, `px-3`, 14px medium, radius 8px. Active chip: `primary` bg / `primary-foreground`. Inactive: `secondary`, hover `muted`.
   - Right side, depending on tab:
     - Summary: Regenerate (`arrow-clockwise`) plus Options (`sliders-horizontal`) → dropdown
     - Chat with messages: ghost "New" button (`note-pencil` + label)
4. **Body** (flex-1, scrolls). One of the views below.
5. **Toast**: bottom-left inside the panel, 12px inset. `primary` bg, 13px, radius 8px, `shadow-pop`. Auto-hides after 1.8s.

Use `ScrollArea` for scroll regions. The scrollbar is 8px; thumb #3f3f3f (dark) / #d0d0d0 (light).

---

## Views & states

### Summary
- **Options dropdown** (`DropdownMenu`, 252px, radius 12px, `popover` bg, 1px border, `shadow-pop`, py-2):
  - Style group: Detailed / TL;DR / Key moments
  - Model group: GPT-5 mini / GPT-5 / Claude Sonnet 4.5 / Gemini 2.5 Flash
  - "Custom prompt…"
  - Items are `px-4 py-2`: check icon (16px, hidden when unselected), name 14px, note 12px `muted-foreground`. Picking a style regenerates.
- **Done** (`p-4`, sections `gap-6`):
  - Lead paragraph: 15/23, `foreground`. This is the TL;DR; there's no heading above it.
  - "Key moments" label: 13px medium, `muted-foreground`; right side "Click to jump" 12px `subtle-foreground`.
  - Moment rows: grid `44px 1fr`, `p-2`, radius 8px, hover `secondary`. Time is mono 12px medium `link`; text 14/21 `card-foreground`. The moment currently playing gets bg `card` and text `foreground`.
  - "Notes" label, then bullet rows: 4px dot `subtle-foreground` + 14/21 `card-foreground`.
  - "In plain terms" card: `secondary` bg, radius 12px, `px-3.5 py-3`, `lightbulb` icon.
  - Footer (top border, `pt-3`): "Useful?" + thumbs up/down (filled when chosen) + copy · spacer · "Ask a follow-up" secondary button (sends the user to Chat with a prefilled draft). Below it, meta at 11px `subtle-foreground`: `Model · Style · Language`.
- **Not started** (auto-summarize off): heading "Summarize this video" 16px medium; "13 transcript segments, 3:42 long. Takes about 5s with {model}."; primary "Generate summary" (`sparkle` icon) and secondary "Just chat"; hint "Turn on auto-summarize in settings to skip this step."
- **Generating**: a step list in a `card` box with radius 12px: Fetching transcript → Reading 13 segments → Writing summary. Each step is done (`check`, `success`), active (spinning `circle-notch`) or pending (`circle`, `subtle-foreground`). A skeleton sits below (bars 12px tall, radius 4px, `secondary`, opacity pulse 1.4s).
- **API error**: `danger-soft` box, radius 12px, `p-4`. Title "Can't reach {provider}" with a `warning-circle` icon in `destructive`. Body "Your key returned 429 — out of credits or rate-limited. I'll retry in 5s, or switch to another model." Buttons: primary "Retry now", secondary "Switch model" (opens Options).
- **No captions**: "This video has no captions" / "I need a transcript to summarize it. I can transcribe the audio — about 40s for a 4-minute video." Primary "Transcribe audio" (`waveform`) becomes a progress bar (4px, `link` fill, % label in mono).

### Transcript (works without a key)
- **Toolbar** (`px-4 pt-3 pb-2`, gap 8):
  - Search input: 36px, radius 8px, `background` bg, `input` border, focus border `ring`, `magnifying-glass` at left 12px.
  - While the input has a query, a cluster sits inside it on the right: `n/m` count (mono 11px), prev/next (`caret-up`/`caret-down`) and clear (`x`). Input right padding becomes 120px.
  - Keys: ⏎ next match, ⇧⏎ previous, Esc clears.
  - Follow toggle: 36px, `crosshair-simple` + "Follow". On = `primary`, off = `secondary`.
  - Copy transcript icon button.
- **List** (`px-2 pb-14`):
  - Chapter headers: 13px medium `foreground` + mono 11px time, `pt-4 pb-1.5 px-2`.
  - Lines: grid `52px 1fr`, `p-2`, radius 8px. Time is mono 12px. Text is 14/21.
  - Active line (current playback): bg `secondary`, time `link`, text `foreground`. Other lines: time `muted-foreground`, text `card-foreground`. Hover bg `card`.
  - Search hits: all matches are highlighted `warning-soft`; the current match is `warning` with #0f0f0f text, radius 3px, and scrolls to ⅓ from the top.
  - Hover on a line shows a floating action pill at top-right (popover bg, border, shadow): "Ask" (`chat-circle`) quotes the line into Chat; Copy copies the line.
  - Clicking a line seeks the video and shows the toast "Jumped to mm:ss".
- **Follow behavior**: while on, smooth-scroll the active line to ⅓ from the top on each line change. A wheel/touch scroll by the user turns Follow off and shows a floating primary button "↓ Back to mm:ss" (bottom-center, 16px up); clicking it turns Follow back on.
- **Filler words**: setting "Remove filler words" strips `um`, `uh`, `you know` (with adjacent commas).
- **No captions**: 44px `closed-captioning` tile, "No captions on this video", body copy, "Transcribe audio" → progress (same as Summary).

### Chat
- **Start screen** (bottom-aligned above the composer, gap 16):
  - "Ask about this video" 16px medium; "Answers link to the moment they came from." 13px `muted-foreground`.
  - Suggestion rows (`py-2.5 px-2`, radius 8px, 14px `card-foreground`, hover `secondary` + `foreground`):
    1. `clock` icon in `link` + "Explain what's happening at **mm:ss**" (live time, mono `link`). Quotes the current transcript line and sends.
    2–4. Generated per video, with a `arrow-bend-down-right` icon. Samples: "What's the main takeaway?", "How does it decide what's static?", "Is it production-ready?"
  - Chips (28px, 12px medium, `secondary`): Explain simply (`graduation-cap`), Quiz me (`exam`), Study notes (`notebook`). Each sends a preset prompt.
- **Messages** (gap 20):
  - User bubble: right-aligned, max 85%, `px-3.5 py-2`, `secondary` bg, radius `12 12 4 12`, 14/21 `foreground`.
    - Optional quoted line above it: `card` bg, border, radius 8px, mono 11px time in `link` + 12px text.
    - Optional "at mm:ss" stamp (mono 11px, `clock` icon).
  - Assistant: grid `24px 1fr`, gap 10. Avatar is the logo 11px in a 24px `secondary` square, radius 6px. Text 14/21 `card-foreground`.
    - Citation chips: 24px, mono 12px medium, `link` on `link-soft`, radius 6px, `play` fill icon 9px. Clicking one seeks.
    - Actions (30px ghost circles): copy, regenerate, thumbs-up.
    - Follow-up suggestions under the **last** reply only: outline buttons (`input` border), 13px.
  - Streaming: three pulsing dots (6px) until the first token, then text with a blinking 7×14 caret. Send becomes Stop (`stop` fill). Stopping keeps the partial text and adds "Stopped." at 12px `subtle-foreground`.
- **Composer** (`px-3 pt-2 pb-3`): a box with `background` bg, `input` border, radius 12px, `p-2.5`.
  - Quoted line (if any): `secondary` row with time + 2-line clamp + remove `x`.
  - Textarea: 2 rows, 14/20, no border. Placeholder "Ask anything about this video".
  - Bottom row:
    - Model picker (ghost 28px, 12px; the dropdown opens **upward**)
    - "Current moment" toggle (`clock`); when on it becomes a `link-soft` chip "at mm:ss ×"
    - Spacer, then Send: 32px circle, `primary` when there's text, `secondary` + disabled foreground when empty.
  - ⏎ sends, ⇧⏎ inserts a newline.

### No key yet (Summary + Chat tabs when no key is saved)
- `p-5 py-7`, gap 20. A 44px `key` tile.
- Heading "Add a key to summarize videos" / "…to chat with videos".
- Body: "This runs on your own API key. No account, no subscription — you pay OpenAI, Anthropic, Google or OpenRouter directly."
- Grouped rows (radius 12px, 1px dividers, `card` bg):
  - `coins` About $0.002 per summary — 4-minute video on GPT-5 mini
  - `lock-simple` Stays on this device — Sent only to the provider you pick
  - `closed-captioning` Transcript works without one — Search, follow and jump are free
- Buttons: primary "Add API key", secondary "Open transcript".

### BYOK: connect (first run, or "Replace" in settings)
- "Connect your API key" 18px medium + "Pick a provider and paste a key. It's stored in Chrome on this device and only sent to that provider."
- **Provider** (`RadioGroup` styled as grouped rows): radio 16px (selected = 5px `foreground` ring), name 14px medium, models 12px, tag 11px right.
  - OpenAI: "GPT-5, GPT-5 mini", tag "Most used"
  - Anthropic: "Claude Sonnet 4.5, Haiku 4.5", tag "Long videos"
  - Google AI: "Gemini 2.5 Flash, Pro", tag "Free tier"
  - OpenRouter: "One key, 300+ models"
- **Key field**: "{Provider} API key" label + "Get a key ↗" link (to the provider's key page). A 40px box holding a mono 13px password input, show/hide eye button and a "Paste" secondary button (reads the clipboard). Placeholder "Paste your key (sk-…)".
- **Validation**: on submit, call the provider's list-models endpoint.
  - Empty → red border + "Paste a key first."
  - Checking → spinner + "Checking with {provider}…", button dimmed.
  - Rejected → red border + `danger-soft` box: "{provider} rejected this key (401)" / "Check it's copied in full and billing is on for that project."
  - Works → green border + `success-soft` box: "Key works. N models available." + chips for the models.
- Button label by state: Test key → Checking… → Test again / Save and continue.
- Footer rows (12px `muted-foreground`, icons in `subtle-foreground`): "Stored in chrome.storage on this device" · "Never sent to my server — there isn't one" · "Remove it anytime in settings".

### Settings (replaces the header with ← back + "Settings" + version)
Grouped sections: section label 13px medium `muted-foreground`; rows `px-3.5 py-3` on `card`, radius 12px, 1px dividers. Use shadcn `Select`, `Switch` (36×20; on = `link`, off = `muted`) and `ToggleGroup` for segmented controls.
1. **Model**: Provider (select) · API key (green dot "Connected" + masked key `sk-…4f2a` in mono; "Replace" opens BYOK) · Default model (select)
2. **Usage**:
   - "This month" + "412k tokens · 38 summaries · 61 chats", with "$0.41" in mono 16px on the right
   - 4px bar showing spend vs limit, then "$0.41 of $5 limit" and "Resets Nov 1"
   - Monthly limit segmented control: $1 / $5 / $20 / Off ("Pauses requests when reached")
   - Footnote: "Estimated from token counts. Your provider's dashboard is the source of truth."
3. **Summaries**: Default style · Answer language (Match video, English, Español, Deutsch, Français, Português, 日本語) · Auto-summarize switch ("Start as soon as a video opens")
4. **Transcript**: Follow playback switch · Remove filler words switch
5. **Appearance**: Theme (Match YouTube / Dark / Light) · Text size S/M/L · Font (Roboto / Geist)
6. **Keyboard shortcuts**: Toggle panel ⌥Y · Focus chat / · Summarize video ⌥S · Search transcript ⌥F (keys shown as mono 11px on `secondary`, radius 4px)
7. **Data**: Export chats ("Markdown, one file per video") · Clear chat history (destructive-soft button; confirm with `AlertDialog`)
8. Footer links: What's new · Send feedback · Privacy

### Other states
- **Collapsed**: header + chapter bar + one status row ("Summary ready · 5 key moments", `check-circle` in `success`, ⌥Y hint). Clicking it expands.
- **No video** (not on /watch): header shows "YouTube AI" / "No video open"; body has a `play-circle` tile, "Open a video to get started", short explanation, and a "⌥ Y toggles this panel anywhere on YouTube" hint.
- **More menu** (header ⋮): Copy link at mm:ss · Open in side panel · Export as Markdown · Keyboard shortcuts · Send feedback.

---

## Interactions
- Every timestamp (moments, transcript lines, citations, chapter segments) calls `video.currentTime = s` on `document.querySelector('video')` and shows the toast "Jumped to mm:ss".
- Playback time: listen to `timeupdate`; derive the active line, active moment and progress fill from it.
- Motion: 150ms `cubic-bezier(0.2,0,0,1)` for color/bg changes and switch thumb travel. Smooth scroll for transcript follow. No bounces.
- Copy wording uses sentence case and no exclamation marks. Errors say what happened and what to do next.

## State (suggested)
```ts
type Tab = 'summary' | 'transcript' | 'chat'
type View = 'main' | 'settings' | 'onboarding' | 'novideo'
summary: { status: 'idle'|'loading'|'done'|'error'|'nocaptions', step: 0|1|2, style, model, feedback?: 'up'|'down' }
transcript: { status: 'ok'|'none'|'transcribing', pct, query, matchIdx, follow }
chat: { messages: Msg[], stream?: { text, n }, draft, quote?: lineIdx, attachTime: boolean }
key: { provider, hasKey, draft, status: 'idle'|'checking'|'invalid'|'valid', show }
settings: { theme, size: 's'|'m'|'l', font, lang, autoSum, follow, fillers, limit }  // chrome.storage.sync (key in chrome.storage.local)
Msg = { role: 'user'|'assistant', text, at?: 'mm:ss', quote?: { time, text }, cites?: number[], follow?: string[], stopped?: boolean }
```
Chat history persists per video ID. The model reply should return citation seconds alongside the text, e.g. ask for JSON or `[mm:ss]` markers and parse them.

## Design tokens
All tokens are in **`globals.css`** (drop-in shadcn / Tailwind v4 theme, dark + light).

Key colors (dark / light):
- Panel bg: #0f0f0f / #ffffff
- Card: #181818 / #f9f9f9
- Secondary: #272727 / #f2f2f2
- Muted / hover: #3f3f3f / #e5e5e5
- Popover: #282828 / #ffffff
- Title text: #f1f1f1 / #0f0f0f
- Body text: #cfcfcf / #333333
- Meta text: #aaaaaa / #606060
- Subtle text: #717171 / #8a8a8a
- Link / timestamps: #3ea6ff / #065fd4
- Progress: #ff0033
- Borders: white or black at 10% (inputs 20% / 18%)

Text sizes for the S / M / L setting:
- Body: 13/19, 14/21, 16/24
- Summary lead: 14/21, 15/23, 17/26

Other:
- Radius: 6 (small chips), 8 (buttons, inputs, chips), 12 (cards, popovers, composer)
- Spacing: 4px grid
- Panel padding: 16px horizontally
- Shadow: popovers and toasts only (`shadow-pop`)

## Assets
- `assets/logo-dark.svg` (#f1f1f1) and `assets/logo-light.svg` (#0f0f0f). In the UI, inline the paths with `fill="currentColor"`.
- Icons: Phosphor (`@phosphor-icons/react`), regular weight; fill weight for play, stop, check-circle and warning-circle.
- Fonts: Roboto 400/500/700 and Roboto Mono 400/500; YouTube already loads Roboto on the page.

## Files
- `prototype/All States.dc.html`: every state, dark + light. Start here.
- `prototype/YT Panel v3.dc.html`: the component (template + logic, including all copy and sample data).
- `prototype/yt-theme.css`: the prototype's theme variables.
- `globals.css`: production shadcn theme.
