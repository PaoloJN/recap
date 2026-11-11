# Competitive landscape: YouTube summarizer extensions

Researched 2026-11-11 from Chrome Web Store listings, review pages, pricing pages and GitHub. Numbers are store counts on that date. "unverified" means the price came from a third-party site because the vendor's pricing page blocked fetching.

## The market in one paragraph

About 36 extensions summarize YouTube videos. They fall into four tiers. General AI assistants (Sider, Monica, Merlin, MaxAI, HARPA) have millions of users and a YouTube button that is often broken. Dedicated YouTube summarizers at scale (Glasp, NoteGPT, Eightify, Glarity, AI Summary for YouTube, Scripsy) all launched in the 2023 ChatGPT wave and run hosted freemium with tight free limits. A long tail of small dedicated tools (Clarify, SubKun, TubeLens, Recapt, Claras, TubeOnAI) launched 2025 to 2026 and are fighting for store search. Bring-your-own-key and open-source tools (Summarize, Summarizerrrr, Magpie, TL;DW, U2) have never passed a few thousand users when YouTube-only. The whole market shares the same two complaints: transcripts break when YouTube changes, and pricing surprises.

## Tier 1: general assistants with a YouTube feature

| Extension | Users | Rating | Pro price | BYOK | YouTube feature state |
|---|---|---|---|---|---|
| Sider | 5M | 4.9 (115k) | ~$10 to $30/mo unverified | yes | summary, shortener; credit burn complaints |
| Monica | 3M | 4.8 (32k) | ~$9.90 to $16.60/mo unverified | no | summary only |
| Tactiq | 1M | 4.9 (4.6k) | $8/mo annual | unknown | transcript web tool, not in-page |
| Merlin | 900k | 4.4 (8.8k) | ~$14 to $19/mo unverified | no | 4 of 10 latest reviews say YouTube is broken |
| MaxAI | 700k | 4.6 (14.5k) | $20/mo or $19/mo annual | paid only | summary and chat; connection failures |
| HARPA | 400k | 4.5 (3.2k) | $12/mo annual | yes | summary; upsell nagging |

They absorb casual users but nobody picks them for YouTube. Not a positioning target. Their broken YouTube features are a source of searchers.

## Tier 2: dedicated summarizers at scale

| Extension | Users | Rating | Free tier | Pro price | BYOK | Open source | Notes |
|---|---|---|---|---|---|---|---|
| Glasp YouTube Summary | 2M | 4.2 (4.1k) | 3 basic/day, 3 advanced/week, 20 chat credits/mo | $15/mo or $150/yr | no | no | Featured. Category leader. Daily-limit confusion. Export to Notion/Obsidian. |
| NoteGPT | 400k | 5.0 (8.9k) | 15/mo | $9.99/mo or $108/yr | no | no | Featured. Mind maps, ASR for no-caption videos, translation. Suspiciously perfect rating. |
| Eightify | 200k | 4.0 (863) | ~3/week unverified | ~$9.99/mo or $59.88/yr unverified | no | no | Hidden pricing until after sign-up. Breaks YouTube layout. No Shorts. |
| Glarity | 100k | 3.7 (271) | session-based free | unverified | yes | yes, GPL | "no transcript available" complaints, users leaving. |
| AI Summary for YouTube | 100k | 3.2 (110) | 7/week | unknown | no | no | Coasting since 2023. Reviews are a churn log. |
| Scripsy | 60k | 3.8 (126) | 1/day | unknown; $49.99 surprise charge reported | no | no | 29 of 111 reviews are 1-star. Breaks after Chrome updates. |
| YouTube Summary with AI (dictanote) | 30k | 3.7 (279) | unlimited | none | no | no | Pastes transcript into your ChatGPT/Gemini tab. Not in-page. |
| Clarify AI | 20k | 4.1 (1.3k) | ~7/day, reportedly cut to 1 | $2.99 or $4.99/mo | unknown | no | Featured. Closest in price to Recap. GPU usage complaints. |
| SubKun | 8k | 4.7 (311) | transcript free | unknown | no | no | ASR, bilingual subtitles, live streams. "Too much stuff". |
| Youtube Summary with GPT | 8k | 3.6 (25) | unknown | unknown | unknown | no | Stalls on "Generating...". |

## Tier 3: small dedicated tools (2025 to 2026 launches)

| Extension | Users | Rating | Free tier | Pro price | BYOK | Notes |
|---|---|---|---|---|---|---|
| TubeLens (TinaMind) | 1k | 3.4 (18) | 30/day, "free forever" | $80/yr | unknown | Sign-in loops, spam comments on YouTube. |
| summarizemyvideo | 1k | 4.2 (10) | 3 summaries | one-time, price hidden, plus own key | yes | "Pay twice" complaints. |
| GPT Breeze | 1k | 4.8 (50) | yes | $15 lifetime BYOK, $25/yr hosted | yes | Timestamped sections, works from homepage. |
| TubeOnAI | 800 | 3.0 (5) | 400 credits | $9/mo or $80/yr | unknown | Paywall shown before first use. |
| Claras | 400 | 5.0 (7) | 3 videos/mo | $5/mo or $29.99/yr | yes, paid only | Bulk and playlist summaries. Possibly delisted. |
| Recapt | 122 | 5.0 (3) | 1/day | $4.99/mo annual ($59.88) or $9.99 monthly | unknown | Watch Guide, chapter timeline. Name collision with Recap. |
| YouTube Transcript: AI Summary & Chat | 64 | 5.0 (6) | 5 transcripts/day | $5/mo or $54/yr | unknown | Chat with timestamp citations. Reviews look seeded. |
| yt-assist, YouTube Transcript Plus, TubeRecap, Summario | under 1k each | | | | | Delisted or dormant. |

## Tier 4: bring-your-own-key and open source

| Extension | Users | GitHub stars | Providers | Notes |
|---|---|---|---|---|
| Summarize (steipete) | 3k | 6.8k | anything, Ollama, coding CLIs | Any page, side panel. Setup friction. Not YouTube-first. |
| Summarizerrrr | 873 | 32 | 6 providers plus local | YouTube, Udemy, Coursera. Zero complaints. |
| Magpie | 26 | 4 | OpenRouter | Side panel, chat. |
| TL;DW | 22 | 1 | Claude, GPT, Gemini | Export to Obsidian, Logseq. |
| U2 | 15 | 1 | OpenAI, Anthropic, Gemini | Transcript with timestamps. Losing users. |
| YouTube Summarizer (osamaahmed) | 6 | 1 | 5 providers | Admits GA4 analytics while listing says no collection. |
| avarayr/youtube-summarizer-oss | n/a | 78 | OpenAI, Google, OpenRouter | Unmaintained. |

Lesson: BYOK plus YouTube-only has never passed 30 users. BYOK only scales bundled with a general-page tool. This confirms the growth note: developers bring a key and don't pay; the hosted tier is the business.

## Complaint clusters across the whole market

1. **Transcript breaks after YouTube changes.** Glarity, Merlin, Scripsy, dictanote, AI Summary for YouTube, Youtube Summary with GPT, TubeLens, Ytsum. The single most common 1-star reason.
2. **Pricing surprises.** Hidden price until after sign-up (Eightify), $49.99 charge (Scripsy), paywall before first use (TubeOnAI), pay twice (summarizemyvideo), $15 confusion (GPT Breeze), fair-use throttling on "unlimited" (Merlin), limit reset confusion (Glasp).
3. **Privacy contradictions.** Store says "will not collect" while the description admits analytics or credentials: Glarity, osamaahmed, GPT Breeze, TubeLens, Scripsy.
4. **Breaks or clutters the YouTube page.** Eightify, TubeOnAI, Youtube Summary with GPT dark theme, dictanote "hide the panel".
5. **Bloat.** SubKun, Sider, Monica. Users ask for toggles.
6. **Gaps people ask for.** Shorts (Eightify), videos without captions (only NoteGPT, SubKun, TubeOnAI do ASR), output in the right language (Clarify, yt-assist, Scripsy).

## Where Recap stands today

Recap Pro: $5/mo or $40/yr, trial of 20 summaries and 50 chats, no card. Own key free forever. Open source, no telemetry.

| Capability | Recap | Best competitor at it |
|---|---|---|
| Store listing | not published yet | everyone |
| In-page sidebar on YouTube | yes | Glasp, Eightify, SubKun |
| Transcript without key or account | yes, searchable, follows playback | dictanote, SubKun, Tactiq |
| Chat with citations that seek the video | yes | Glasp, YouTube Transcript: AI Summary & Chat |
| Current-moment marker and chapter bar | yes, nobody else has this | none |
| Summary styles | 3 | NoteGPT, Clarify (length and tone) |
| Export | Markdown | Glasp (Notion, Obsidian, Roam), TL;DW |
| Keyboard shortcuts | 4 | few |
| BYOK | 4 providers with model picker | Summarize, Summarizerrrr |
| Hosted no-key option | Pro | all hosted players |
| Videos without captions | no (Phase 3) | NoteGPT, SubKun, TubeOnAI |
| Shorts | no (Phase 3) | AI Summary for YouTube, TL;DW, SubKun |
| Translation and bilingual subtitles | no | SubKun, TubeLens, Glarity |
| Mind maps, slides, podcasts | no, don't need | NoteGPT, TubeLens |
| Other sites | no | Glasp, Glarity, Summarize |
| Languages | answer language setting | Eightify 40+, NoteGPT 40+ |
| Price | cheapest hosted plan except Clarify Basic | Clarify $2.99, Claras $29.99/yr |

## How to be better: three claims nobody else can make honestly

1. **"It doesn't break."** Phase 2 as planned: remote config kill switch, daily transcript canary, server-side summary cache. Then say it on the listing and prove it with an uptime page on recapai.dev. Every competitor at scale has the opposite reputation.
2. **"Price on the box."** $5/mo and $40/yr on the store listing, on the welcome page, and on the first summary card. No card for the trial. The upgrade prompt appears only after a limit, after a good summary.
3. **"Read the code."** No telemetry, verifiable. One line on the listing: "Open source. Your key and your transcripts never touch our servers unless you choose Pro." The Pro privacy section already says this.

Product edges to keep sharp: the current-moment marker, chapter bar and citation chips that seek are the only features in this table that no competitor has. Lead the screenshots with them.

Gaps to close in order: Shorts (cheap, requested), audio transcription for no-caption videos (Pro-only, revenue), output language that actually sticks.

## Who to target first

Searchers leaving broken tools. Comparison pages, one per name, aimed at the exact complaint:
- "Merlin YouTube summary not working"
- "Glarity no transcript available"
- "Eightify alternative" (hidden pricing, no Shorts)
- "AI Summary for YouTube alternative"
- "Scripsy alternative" (surprise charges)
- "Glasp YouTube Summary limit" (3 a day)

Store title keywords, from what ranks: "YouTube Summary", "Transcript", "AI", "Chat". Suggested: "Recap: AI YouTube Summary, Transcript & Chat".

## Sources

Store listings and review pages for every extension above (chromewebstore.google.com/detail/<id> and /reviews). Pricing pages: glasp.co/pricing, notegpt.io/pricing, clarify-ai.org/pricing, harpa.ai/pricing, maxai.me/pricing, bibigpt.co/pricing, tubeonai.com/pricing, tinamind.com/pricing, getrecapt.com/pricing, meetclaras.com/pricing, getyoutubetranscript.com/pricing, tactiq.io/pricing. Third-party where blocked: zemith.com (Monica, Sider, Merlin), extscope.org and chromeboard.com (delisted listings). GitHub: steipete/summarize, trongnguyen24/Summarizerrrr, fav83/magpie, ndimoro/youtube-summarizer, SudShekhar/U2, avarayr/youtube-summarizer-oss, sparticleinc/chatgpt-google-summary-extension.
