# Roadmap and growth plan

Goal: $1k MRR. Written 2026-10-29.

## Positioning

Competitors (Eightify, Glasp, NoteGPT, Merlin, "YouTube Summary with ChatGPT & Claude") are bloated, paywall hard and treat privacy as an afterthought. Recap wins on: the best-made YouTube panel, honest pricing, bring-your-own-key free forever, open source, no telemetry.

## Product phases

### Phase 1: Go live (now)
- recap-website: landing page, privacy policy, Pro sign-in, Polar billing.
- Chrome Web Store listing: keyword-rich title, 5 benefit screenshots, 30s demo video.
- Welcome page on install (`onInstalled`), uninstall survey (`setUninstallURL`).
- Done when: a stranger can find it, install it and pay without help.

### Phase 2: Never break, always fast
- Pro caches summaries server-side by video ID, model and summary style. Repeat summaries are instant and nearly free.
- Remote config / kill switch for the transcript fetch, so YouTube changes are fixed without a store review.
- Daily scheduled check that fetches a known video's transcript and alerts on failure.
- Done when: a YouTube change is fixed within hours, not days.

### Phase 3: Features competitors do badly
- Pro: transcribe the audio of videos without captions.
- Summaries on hover over thumbnails (home and search), and Shorts support.
- Done when: there's no YouTube video Recap can't handle.

### Phase 4: Retention and growth loops
- Library on recapai.dev: every summarized video, searchable and synced.
- Share links that create public summary pages (`recapai.dev/v/{videoId}`), stamped "Made with Recap". Only let Google index the good ones.
- Export to Notion, Obsidian, Readwise.
- Invites that give both sides extra free Pro summaries.
- Done when: users come back weekly and shared links bring in installs.

### Phase 5: Expand
- Translations (`_locales`), starting with the top 10 languages for the store listing and interface.
- Publish on Edge and Firefox.
- Study tools (flashcards, quizzes), other video sites (Coursera, Udemy, podcasts).

## Growth plan

Launches gave only one-off spikes when tried before. Skip them. Use channels that keep sending people every week.

### The math
- About $8/mo → about 125 paying users for $1k MRR.
- Extensions usually convert 1–3% of active users to paid → about 5–10k active users needed.

### Who pays
- Developers bring their own key and won't pay. Payers are students, researchers and podcast listeners who don't know what an API key is.
- Show the Pro free trial first in setup, with "Use my own key" as the secondary option. Probably the biggest revenue lever.
- Open source is for trust ("no tracking, you can read the code") and backlinks. Don't market to developers.

### Channels that keep sending people
1. Chrome Web Store search: keyword title, screenshots, an in-extension review prompt (once, after the 3rd successful summary), Featured badge at about 100 users.
2. Free tools on recapai.dev: a YouTube transcript downloader and a paste-a-link "YouTube summary" page. They rank on Google and send people to the extension. Main SEO bet.
3. YouTube tutorials: 3–5 plain videos ("How to summarize YouTube videos with AI (free)", "How to get a YouTube transcript"). They keep getting views for years.
4. Helpful answers on existing Reddit and Quora threads that rank on Google ("how to summarize long YouTube videos").
5. Comparison pages: "Eightify alternative", "Recap vs NoteGPT", "Best YouTube summarizer 2026".

### Converting users to paid
- Show the upgrade prompt when a trial user hits a limit right after a great summary, not on install.
- Annual billing at about $60/yr.
- Track installs → trial → paid weekly; fix the weakest step first.
- Website analytics (Vercel Analytics or Plausible) are fine; the extension stays free of tracking.

### Weekly routine (about 3 hours)
- 1 tutorial video or 1 SEO page.
- 3 helpful Reddit or Quora answers.
- Check the install → trial → paid numbers.

## Next
Build the free transcript tool page on recap-website.
