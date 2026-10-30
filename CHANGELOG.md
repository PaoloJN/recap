# Changelog

## Unreleased

- Recap Pro, an optional build-time tier: sign in with Google, a free trial (20 summaries, 50 chat messages), then a paid plan managed at recapai.dev. "Use my own key" stays available.
- Recap Pro account, plan and usage in Settings, with Upgrade, Manage billing and Sign out.
- Clear messages when the trial runs out, a limit is reached or the session expires, each with a way back to your own key.
- Builds set `WXT_PRO_ORIGIN` to turn Recap Pro on; without it the extension is bring-your-own-key only, as before. Pro builds add no permission and no host access, so existing installs update without a new permission prompt.
- Recap Pro sign-in opens recapai.dev in a normal tab and returns you to the video; the panel waits for it, with "Open it again" and "Cancel". The Firefox build now needs Firefox 115 or later.

## 2.0.0 — 2026-10-26

- Ground-up rebuild on WXT, React 19, TypeScript and the Vercel AI SDK.
- Redesigned panel from the v3 design handoff: new shell, header, tabs, settings and icons, in dark and light.
- Structured summary with key moments, notes, plain-terms paragraph and a current-moment marker; Detailed, TL;DR and Key moments styles.
- Chapter bar synced to playback, with click to jump.
- Transcript that works without a key: search, follow playback, jump, chapter headers, copy.
- Chat with transcript quotes, a "Current moment" toggle, citation chips and per-video history.
- Starter questions drawn from the summary.
- Bring your own key for OpenAI, Anthropic, Google or OpenRouter, with a model picker and an in-panel key test.
- Monthly usage counters for tokens, summaries and chats.
- Auto-summarize, filler-word stripping, answer language and custom instructions.
- Text size and theme settings.
- Export to Markdown for one video or all chats.
- Shortcuts: `Alt+Y` toggle, `Alt+C` chat, `Alt+S` summarize, `Alt+F` search transcript.
- Transcript source that uses YouTube's own transcript feature, replacing the dead caption-URL method.

## 1.x

The Plasmo-based version is tagged `v1-legacy`.
