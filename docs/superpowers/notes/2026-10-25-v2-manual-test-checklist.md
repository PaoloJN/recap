# v2 manual test checklist (owner, Chrome)

Load `.output/chrome-mv3` as an unpacked extension (chrome://extensions → Developer mode → Load unpacked), add a key via the gear icon, open a captioned video.

## Task 10
1. The card appears above "Up next" on a watch page.
2. Tabs switch (Summary / Transcript / Chat); clicking a tab while collapsed opens it.
3. Collapse state persists across a reload (and the default on first install is collapsed).
4. Settings: save a key → the "Add an API key" empty state goes away; Remove brings it back.
5. Toggling YouTube's dark/light theme re-themes the card.
6. The model `Select` dropdown is styled (rendered inside the shadow root, correct theme too).
7. Typing in the key field does not trigger YouTube shortcuts (e.g. `k`, `f`, `/`).
8. `Alt+Shift+Y` toggles the panel.
9. Navigating to another video updates the title in the header (title shows only when the card is >= 480px wide).
10. The home page removes the card; going back to a watch page re-adds it.
11. Extra: copy-URL button shows a check for 2 s and the clipboard has the URL; tooltips render styled; a video without captions shows "This video has no transcript".
- Replaces item 9: when the card is open, a slim `title · channel` strip shows at the top of the content card at any sidebar width. Navigating to another video updates it. It's absent in the no-key state and while collapsed, because nothing is fetched then.
- New: with the card collapsed, or with no key, navigating between videos does not open YouTube's description or transcript panel.
## Task 11
- Rows follow playback (active row highlighted and smoothly centered).
- Click a row seeks the video to its time.
- Search filters rows and highlights matches; X clears; no auto-scroll while searching; empty result shows "No matches for ...".
- Copy button copies ALL rows (not just filtered) with `[m:ss]` prefixes; icon shows a check for 2 s.
- Language badge shows the track code (uppercase).
- After manually scrolling (wheel/touch) the "Jump to current" button appears; clicking it scrolls to the active row and resumes following.
- Only one scrollbar in the transcript tab; Summary/Chat/Settings scroll as before; Header copy-URL still works.
## Task 12
- Each preset (TL;DR, takeaways, chapters) streams Markdown.
- Timestamp chips click-seek the video.
- Copy works (Check icon for 2 s, pastes raw Markdown).
- Switching to Transcript and back keeps the summary (also across videos/presets within the tab).
- A wrong key shows the "Invalid API key" message with Retry.
- Regenerate bypasses the cache (new text streams, not the cached one).
- Stop keeps the partial text (and a later Generate re-streams, since partial is not cached).
## Task 13
- [ ] Streaming answer renders (Markdown, progressively).
- [ ] Timestamps in answers seek the video.
- [ ] Stop halts generation (submit button turns into Stop while streaming).
- [ ] Reload restores history for the same video.
- [ ] Clear chat empties it (and stays empty after reload).
- [ ] A different video starts clean.
- [ ] 21st video evicts the oldest stored chat.
- [ ] Starter question prefill works ("What did they say about " in the input, cursor at end).
- [ ] Other three starter questions send immediately.
- [ ] Retry after an error re-sends (e.g. invalid key → error line → fix key → Retry).
- [ ] Enter submits, Shift+Enter inserts newline; typing in the box does not trigger YouTube shortcuts.
- [ ] Changing model in settings applies to the next message without losing the conversation.
## Added by the final review
- Timestamps in a summary or chat answer render as chips (links), and clicking one seeks the video (no Streamdown "open link?" dialog).
- Start a chat answer or summary, switch to another tab and back: the stream continues and nothing is lost. Open Settings mid-stream and come back: same.
- Clear chat while an answer is streaming, then reload: the chat stays empty.
- Press Stop on a summary before any text arrived: the panel returns to the Generate state (not an empty "done").
- With a wrong key, wait for the error: it reads "Invalid API key. Check it in Settings." (not a raw provider message), and the panel does not spin forever.
- On a video with no transcript, YouTube's own transcript panel never pops open and the description stays collapsed.
