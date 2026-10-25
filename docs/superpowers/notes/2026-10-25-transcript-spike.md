# Transcript spike (2026-10-25)

All results observed in Chrome on www.youtube.com, logged in, via `fetch` from the page. Client observed: `clientName: "WEB"`, `clientVersion: "2.20261023.01.00"`, `hl: "en"`, `gl: "US"`.

## Headline

**`POST /youtubei/v1/get_transcript` cannot be called from an extension.** The simple `params` (field 1 = video id) returns 400. Even YouTube's own `params` string returns 400 unless the body also carries a BotGuard attestation (`context.request.attestationResponseData`) that only the page's own JS can produce. We must not forge or lift that (project rule: no proof-of-origin forgery).

**`POST /youtubei/v1/get_panel` works** with the page's own client context, no auth header, no API key, no cookies beyond the normal same-origin ones, and `params` built from the video id alone. It returns the same transcript YouTube's "modern transcript" panel shows. Use this as the primary source. DOM scraping is the fallback.

## 1. get_transcript (legacy panel): what we tried

Endpoint `POST https://www.youtube.com/youtubei/v1/get_transcript?prettyPrint=false` (the page sends no `key` query param, it relies on headers).

Simple params from the brief: bytes `[0x0a, 0x0b, ...utf8("Tn6-PIqc4UM")]` -> base64 `CgtUbjYtUElxYzRVTQ==`. Result: **HTTP 400** `{"error":{"code":400,"message":"Precondition check failed.","status":"FAILED_PRECONDITION"}}`. **Did not work.**

The real params the page uses (found in `ytInitialData` at `engagementPanels[].engagementPanelSectionListRenderer.content.continuationItemRenderer.continuationEndpoint.getTranscriptEndpoint.params`) decode to protobuf: field 1 = video id (`0a 0b Tn6-PIqc4UM`), field 2 = a url-encoded base64 string `CgNhc3ISAmVuGgA%3D` (itself protobuf: kind `asr`, language `en`, empty string), field 3 = 1, field 5 = `engagement-panel-searchable-transcript-search-panel`, fields 6,7,8 = 0,1,1. The full string is URL-encoded base64 and has to be sent as-is. Sending it with the simple body also returned **400**.

What the page's own request actually looks like (captured by wrapping `fetch`, values not recorded):
- Request object, `credentials: same-origin`, body gzip-compressed (`content-encoding: gzip`).
- Headers: `authorization` (SAPISIDHASH scheme, see below), `content-type: application/json`, `x-goog-authuser`, `x-goog-visitor-id`, `x-origin`, `x-youtube-bootstrap-logged-in`, `x-youtube-client-name: 1`, `x-youtube-client-version`.
- Body keys: `context`, `params`, `languageCode`, `kind`, `externalVideoId`.
- `context.request` has `useSsl`, `internalExperimentFlags: []`, `consistencyTokenJars: []` and **`attestationResponseData: { challenge, webResponse }`**.

Bisecting (each with a valid SAPISIDHASH, exact body):
- Removing `attestationResponseData` only -> 400. Replacing `context` with `ytcfg.data_.INNERTUBE_CONTEXT` (no attestation) -> 400. Removing `externalVideoId` -> 400. Removing `languageCode` -> 200. Removing `kind` -> 200 but empty. Removing `internalExperimentFlags`/`consistencyTokenJars` -> 200.
- No `Authorization` header -> 400. `SAPISIDHASH <ts>_<sha1(ts + " " + SAPISID + " " + origin)>` (no `_u` suffix, single scheme) was accepted; the `_u` suffix variant was rejected. The page itself sends three schemes (SAPISIDHASH, SAPISID1PHASH, SAPISID3PHASH, each `<ts>_<sha1>_u`).
- Replaying the page's own cloned Request returned 200 with 70 segments. That is the only way I got a 200, and it reuses the page's attestation, so it is not a viable design.
- With the page's own request, response is **HTTP 200**. Fixture: `src/lib/transcript/__fixtures__/get-transcript.en.json`.

Conclusion: needs (a) SAPISIDHASH auth, (b) `externalVideoId`, (c) a page-generated attestation. (c) rules it out. I did not try any other client contexts.

Legacy response path (documented in case the DOM/legacy shape is ever needed): `actions[0].updateEngagementPanelAction.content.transcriptRenderer.content.transcriptSearchPanelRenderer.body.transcriptSegmentListRenderer.initialSegments[]`. Entries are either `transcriptSegmentRenderer` `{ startMs: "240", endMs: "2720", snippet: { runs: [{ text }] }, startTimeText: { simpleText: "0:00" }, accessibility, targetId }` (**`startMs`/`endMs` are strings**) or `transcriptSectionHeaderRenderer` `{ startMs, endMs, sectionHeader.sectionHeaderViewModel.headline.content }` (chapter headers, skip them). Language menu: `footer.transcriptFooterRenderer.languageMenu.sortFilterSubMenuRenderer.subMenuItems[] { title, selected, continuation.reloadContinuationData.continuation }` (continuation is another params string; untested because get_transcript is unusable). Segments are about 2 s long (70 entries for a 128 s video).

## 2. get_panel (modern panel): the working call

Observed that some videos (the Japanese one below) open the panel `PAmodern_transcript_view`, which uses `get_panel` and `transcript-segment-view-model` in the DOM. The same call also works for videos that show the legacy panel in the UI (verified on `Tn6-PIqc4UM`).

```
POST https://www.youtube.com/youtubei/v1/get_panel?prettyPrint=false
content-type: application/json
(no Authorization, no x-goog-*, no key param needed)

{
  "context": { "client": { "clientName": "WEB", "clientVersion": "<ytcfg INNERTUBE_CONTEXT.client.clientVersion>", "hl": "en", "gl": "US" } },
  "panelId": "PAmodern_transcript_view",
  "params": "<base64 of protobuf>"
}
```

`credentials: "same-origin"` (default for same-origin fetch). Tested: full ytcfg `INNERTUBE_CONTEXT` + key in URL: 200. Minimal 4-field client, no key, no extra headers: 200. With SAPISIDHASH: 200 (not needed).

### params encoding (works, built from the video id only)

Protobuf: field 149 (tag bytes `0xaa 0x09`, wire type 2) containing a message `{ field 1 (string) = videoId, field 3 (varint) = 2 }`.
Bytes: `[0xaa, 0x09, N, 0x0a, L, ...utf8(videoId), 0x18, 0x02]` where `L = byteLength(videoId)` (11) and `N = L + 4` (15).
Example for `pcD9vh1jtBE`: `aa 09 0f 0a 0b 70 63 44 39 76 68 31 6a 74 42 45 18 02` -> base64 (standard alphabet, with padding) is 24 chars. This is byte-identical to the `params` the page sends (checked), found in `ytInitialData` at `engagementPanels[].engagementPanelSectionListRenderer.content.structuredDescriptionContentRenderer.items[].videoDescriptionTranscriptSectionRenderer.primaryButton.buttonRenderer.command.commandExecutorCommand.commands[].showEngagementPanelEndpoint.globalConfiguration.params`.

```ts
function panelParams(videoId: string): string {
  const id = new TextEncoder().encode(videoId)
  const inner = [0x0a, id.length, ...id, 0x18, 0x02]
  return btoa(String.fromCharCode(0xaa, 0x09, inner.length, ...inner))
}
```
(single-byte lengths are fine, video ids are 11 chars.)

Works even when called from a different video's tab (verified), so the fetcher does not depend on `ytInitialData` being fresh after SPA navigation.

### Auth finding
Not required for `get_panel`. For `get_transcript` an `Authorization: SAPISIDHASH <unix_ts>_<sha1hex(ts + " " + SAPISID + " " + origin)>` header was required, plus the attestation. Never put real values anywhere.

### HTTP statuses
- Video with captions: 200 (about 18-29 KB).
- No-caption video: 200 with a tiny body (about 960 bytes).
- No 401/403 observed anywhere.

### Response shape (captions present)
Root keys: `responseContext`, `content`, `trackingParams`, `frameworkUpdates`.

Segments path:
`content.engagementPanelSectionListRenderer.content.sectionListRenderer.contents[]`
-> each element has `itemSectionRenderer` with `{ contents[], header?, sectionIdentifier, trackingParams }`
-> `itemSectionRenderer.contents[]` elements are `macroMarkersPanelItemViewModel`:

```
macroMarkersPanelItemViewModel.item.timelineItemViewModel
  .timestamp                                  "1:05"     (display string)
  .contentItems[0].transcriptSegmentViewModel
      .simpleText                             the caption text (string, whole text, not runs)
      .timestamp                              "1:05"
      .timestampA11yLabel                     "1 minute, 5 seconds"
      .timestampUtf16Length / .textUtf16Length  numbers
macroMarkersPanelItemViewModel.index          number (global order)
macroMarkersPanelItemViewModel.onTap.innertubeCommand.watchEndpoint.startTimeSeconds   number (integer seconds)
```

- **There is no `startMs`/`endMs` in this format.** Start time = `watchEndpoint.startTimeSeconds` (number, integer seconds, preferred) or parse `timestamp` (`m:ss`; `h:mm:ss` presumably for videos over an hour, not observed). No end time: derive from the next item's start.
- Video with chapters (`Tn6-PIqc4UM`): one `itemSectionRenderer` per chapter (3 sections, 16 items total for a 128 s video, items about 5-10 s of text each). `itemSectionRenderer.header` is a `macroMarkersPanelItemViewModel` whose `item.timelineChapterViewModel.title` is `"Chapter 1: Intro"`. Header has no `contents`; do not treat it as a segment. Without chapters (`pcD9vh1jtBE`): one section with no `header`, `sectionIdentifier: "timeline_view_section0"`, and the items are shorter (about 8 s). The whole transcript is returned in one response (no continuation was needed in either test; the header has a search-box continuation token which is irrelevant).
- Iterate all sections, skip anything without `transcriptSegmentViewModel`.
- Fixtures: `get-panel.ja.json` (10 items, no chapters, text verbatim), `get-panel.en.json` (2 chapter sections, 4 + 2 items; items 2+ have text shortened to a prefix; the full-text first item is verbatim). Tracking params, tokens, palettes, `style`, `responseContext`, `frameworkUpdates` were stripped.

### No transcript
Video `d35tmCKP4ds`: `get_panel` returns HTTP 200 with root keys `responseContext` and `trackingParams` only, i.e. **no `content` key**. Treat "`content.engagementPanelSectionListRenderer...contents` missing or zero segments" as no transcript. Also observable beforehand: `ytInitialPlayerResponse.captions` is undefined (no `captions` key at all) and the page has no "Show transcript" button, no `ytd-video-description-transcript-section-renderer`, and no transcript panel in `ytInitialData`.

### Non-English manual captions
URL used: `https://www.youtube.com/watch?v=pcD9vh1jtBE` (Netflix "Infinity" clip, Japanese). `captionTracks` has a single entry, `languageCode: "ja"`, `kind` undefined (manual). `get_panel` returned 200, 11 items, Japanese text in `simpleText`. Request used the same params recipe, with no language input. The same video opened `PAmodern_transcript_view` in the UI.

### Choosing a language track
Not determined. `get_panel` responses contain no language menu, and the only params fields I know are videoId and the constant `3 = 2`. For videos with several tracks (not tested) the response language is whatever YouTube picks as default (the player's default caption track). I did not guess at extra params fields. In the legacy get_transcript format the language menu is `subMenuItems[].continuation.reloadContinuationData.continuation`, but that endpoint is unusable. Recommendation: use the default, and have the fetcher compare nothing; if a language choice is ever needed, spike it separately.

## 3. Watch page HTML (for getting the video id / key / context)

The 2023 caption `baseUrl` is dead: `captionTracks[0].baseUrl` (host `https://www.youtube.com/api/timedtext`) fetched from the page returned **200 with an empty body** (verified on `Tn6-PIqc4UM`).

`get_panel` only needs `clientName`, `clientVersion`, `hl`, `gl`, so the fetcher can read them from `window.ytcfg.data_.INNERTUBE_CONTEXT.client` (page world) or regex them out of the HTML. Structure of the real page (fixture `src/lib/youtube/__fixtures__/watch-page.html` mirrors it):

- `<script nonce="...">(function ytBootstrapConfig() {window.ytplayer={};\nytcfg.set({...});window.ytcfg.obfuscatedData_ = [];...` : one huge script (about 760 KB) holding `ytcfg.set({...})` with `"INNERTUBE_API_KEY":"..."` and `"INNERTUBE_CONTEXT":{"client":{...}}` (`client` has 26 keys incl. `visitorData`, never store it). A second tiny `ytcfg.set({...})` (about 100 chars, `yt_ad` flags) comes later in the page: match the first one, or search for `"INNERTUBE_CONTEXT"` directly.
- `<script nonce="...">var ytInitialPlayerResponse = {...};var meta = document.createElement('meta'); ...` : regex `/var ytInitialPlayerResponse\s*=\s*(\{.+?\});\s*var\s/s` works on both the real page and the fixture. Contains `videoDetails` (`videoId`, `title`, `lengthSeconds` string, `author`, ...), `captions.playerCaptionsTracklistRenderer.captionTracks[]` (`baseUrl`, `name.simpleText`, `vssId`, `languageCode`, `kind` = `"asr"` or undefined for manual, `isTranslatable`), `playabilityStatus.status`.
- A page fetched via `fetch('/watch?v=...')` is about 2.4 MB.

## 4. DOM fallback

Both panel types exist; the fallback must handle both.

Opening (verified on both video types):
1. Description starts collapsed; the transcript button is in the description. Click "...more": `#description-inline-expander #expand` (`tp-yt-paper-button#expand` inside `ytd-text-inline-expander`, text "more", no aria-label). Then the button `ytd-video-description-transcript-section-renderer button[aria-label="Show transcript"]` (text "Show transcript"; there are two in the DOM, only one visible, so pick the one with `offsetParent !== null`). A click while the description is collapsed did nothing on the Japanese video but worked on the English one, so always expand first.
2. The panel then opens. Legacy variant: `ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]`, `visibility="ENGAGEMENT_PANEL_VISIBILITY_EXPANDED"`. Modern variant: `ytd-engagement-panel-section-list-renderer[target-id="PAmodern_transcript_view"]`.

Legacy rows: `ytd-transcript-segment-renderer` inside `div#segments-container`. Start time text: `.segment-timestamp` (text `0:00`, with whitespace, trim it); text: `.segment-text` (`yt-formatted-string`); row root `div.segment[role=button]` has `aria-label="0 seconds react a javascript..."`. Chapter headers are `ytd-transcript-section-header-renderer`. **Rows appear twice in the document (two transcript renderers, 134 rows for 67 real ones), so scope the query to the engagement panel element above.**

Modern rows: `transcript-segment-view-model` (class `ytwTranscriptSegmentViewModelHost`) with children `div.ytwTranscriptSegmentViewModelTimestamp` (text `0:01`), `div.ytwTranscriptSegmentViewModelTimestampA11yLabel` (`1 second`), and a `span[role=text]` with the caption text. Ancestors: `timeline-item-view-model` > `macro-markers-panel-item-view-model` > `yt-item-section-renderer`. Only the first few items were rendered as DOM in the one case I looked at (11 of 11 on the short video); long videos were not checked for virtualisation.

Closing: `ytd-engagement-panel-section-list-renderer[target-id=...] ytd-engagement-panel-title-header-renderer #visibility-button button` (`aria-label="Close"`). Observed to work on the legacy panel. Close-by-aria-label `button[aria-label="Close"]` inside the panel worked on the modern one (its `closest('[id]')` is `#visibility-button`).

"Show transcript" button: `button[aria-label="Show transcript"]` (the legacy panel also has `button[aria-label="Close transcript"]` in the panel header).

No-caption video: none of the above exist.

## 5. Notes for the next tasks

- Task 4 parser should parse the `get_panel` format (`get-panel.*.json`); `get-transcript.en.json` is kept as the legacy shape reference, optional to support.
- Task 5 fetcher: build `params` from the video id, POST `get_panel` with the minimal client context read from the page, handle missing `content` as "no transcript", and fall back to the DOM (both variants) on a non-200 or parse failure.
- Brief listed `get-transcript.ja.json`; it does not exist because get_transcript could not be called for that video. `get-panel.ja.json` replaces it.
