# v3 manual test checklist (owner, Chrome)

Run `pnpm build`, then load `.output/chrome-mv3` as an unpacked extension (chrome://extensions → Developer mode → Load unpacked). Open a captioned video with chapters. Repeat the visual checks in dark and light.

## Shell
1. The card mounts at the top of the sidebar, 640px tall when open, auto height when collapsed.
2. Header play/pause glyph and `mm:ss` follow the real video.
3. Chapter bar shows one segment per chapter; click jumps and toasts "Jumped to mm:ss"; hover shows `Chapter · mm:ss`.
4. A video with chapters shows segments; a video without shows one bar.
5. Tabs switch Summary / Transcript / Chat; right-side actions change per tab (Regenerate + Options, nothing, New).
6. Navigating to another video updates the title, channel and chapter bar.
7. Leaving /watch removes the card; returning re-adds it.
8. Typing in the panel does not trigger YouTube shortcuts.

## Collapsed
9. Collapse state persists across reload.
10. The status row reads "Ready to summarize" with a key, "Add a key to get started" without one.
11. During a summary it reads "Summarizing…", then "Summary ready · N key moments".
12. Clicking the row or title expands; the right side shows `⌥ Y`.
13. Collapsed, no transcript or YouTube panel is opened and no LLM call is made.

## Summary
14. Idle shows segment count, length and estimate; "Generate summary" starts it; "Just chat" goes to Chat.
15. Loading shows the steps card, then the live summary streams in.
16. Done shows lead, key moments, notes and "In plain terms"; the current moment tracks playback.
17. Clicking a key moment seeks the video.
18. Thumbs up/down toast "Thanks, noted"; copy toasts "Copied as Markdown".
19. "Ask a follow-up" opens Chat with a prefilled draft.
20. Options: switching style regenerates; switching model does not; Custom instructions opens Settings.
21. Regenerate replaces the cached summary; reopening the video shows the cached one.
22. A bad request shows the error box with Retry now and Switch model.
23. Auto-summarize on: opening the card starts a summary once per video.

## Transcript
24. Works with no key. Rows follow playback; click a row to seek.
25. Chapter headers appear before the right lines.
26. Search highlights matches, current match in warning colour; Enter / Shift+Enter / Esc work.
27. Scrolling manually turns Follow off and shows "Back to mm:ss"; the button resumes it.
28. Copy gives `m:ss text` lines and toasts.
29. Hover pill: Ask quotes the line in Chat; Copy copies it.
30. Remove filler words strips um / uh / you know in display and copy.
31. Video without captions: no-captions states in Summary and Transcript, and the collapsed row says "No captions on this video".

## Chat
32. Start screen shows three starter questions (from the summary when there is one), the "Explain what's happening at mm:ss" row and the quick chips.
33. Send streams dots, then text with a caret; Send becomes Stop; Stop keeps the partial text and adds "Stopped."
34. Citation chips (`play` + `m:ss`) seek the video.
35. "Current moment" toggle adds an `at mm:ss ×` chip; the answer is about that moment.
36. Quote row shows a quoted line and can be dismissed.
37. Copy, Regenerate (last reply only) and thumbs work on assistant messages.
38. Enter sends, Shift+Enter inserts a newline; the model picker opens upward and changes the model.
39. New clears this video's thread; history persists per video across reload.

## No key / Connect
40. Summary and Chat show the no-key gate; "Open transcript" goes to Transcript.
41. Add API key opens the connect view; provider rows show OpenAI, Anthropic, Google AI, OpenRouter.
42. Show/hide and Paste work; Get a key opens the provider page.
43. A valid key shows "Key works. N models available." and model chips.
44. A wrong OpenAI / Anthropic / Google key shows "rejected" with the status.
45. A wrong OpenRouter key is rejected (401).
46. Offline shows "Couldn't reach {Provider}. Check your connection."
47. Save and continue stores the key and selects the provider.

## Settings
48. Gear opens Settings with ← back and the manifest version; chapter bar and tabs are hidden.
49. API key row: Replace opens connect, Remove brings the gate back.
50. Usage shows tokens, summaries and chats for this month and the reset date; counts rise after a request.
51. Summaries: auto-summarize (default off), custom instructions (500 char max), answer language.
52. Appearance: Theme and Text size apply immediately.
53. Clear chat history dialog stays inside the card; confirm clears, cancel does not.
54. Footer links: feedback, What's new, Privacy (opens the README Privacy section).

## Shortcuts
55. Alt+Y toggles the panel (rebindable at chrome://extensions/shortcuts).
56. Alt+C opens the card, shows Chat and focuses the composer.
57. Alt+S opens the card and starts a summary.
58. Alt+F opens the card, shows Transcript and focuses search.
59. Alt+S while typing in YouTube search does nothing.
60. More → Keyboard shortcuts opens Settings at the shortcuts section.

## Export
61. More → Export as Markdown downloads `<title>.md` with summary and chat.
62. Settings → Export chats downloads one `youtube-ai-chats.md`.

## Theme & text size
63. Theme: YouTube follows YouTube's dark/light toggle; Dark and Light override it; menus and dialogs match.
64. Text size S and L change body and summary text only, not header, tabs or menus.
65. Roboto Mono renders for timestamps and key hints.

## Edge cases
66. Very long title and channel truncate without breaking the header.
67. Switching provider uses that provider's key and model list.
68. A video with an empty transcript shows an error state, not a blank panel.
