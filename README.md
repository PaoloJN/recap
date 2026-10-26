# YouTube AI

Chat with YouTube videos. Summaries, searchable transcripts and Q&A in the sidebar, powered by your own OpenAI, Anthropic or Google key.

![Screenshot](assets/screenshot.png)

## Features

- Summary presets: TL;DR, Key takeaways and Chapters.
- Transcript that follows playback, with click-to-seek, search and copy.
- Chat with per-video history and suggested questions.
- Clickable timestamps in every AI answer.
- Bring your own key for OpenAI, Anthropic and Google, with a model picker.
- Follows YouTube's light and dark theme.
- `Alt+Shift+Y` toggles the panel. Rebind it at `chrome://extensions/shortcuts`.

## Install

From a release:

1. Download the zip from the [latest GitHub Release](https://github.com/PaoloJN/youtube-ai-extension/releases/latest).
2. Unzip it.
3. Open `chrome://extensions` and turn on Developer mode.
4. Click Load unpacked and select the unzipped folder.

Or build from source, as described under Development, and load `.output/chrome-mv3` the same way.

## Setup

Open the panel on a YouTube video, click the gear icon, choose a provider and paste your API key. Get a key here:

- OpenAI: https://platform.openai.com/api-keys
- Anthropic: https://platform.claude.com/settings/keys
- Google: https://aistudio.google.com/apikey

## Privacy

- Your key is stored in the extension's local storage and sent only to the provider you pick. It goes nowhere else.
- There is no analytics or tracking.
- Transcripts come from YouTube's own transcript feature. It is undocumented and may change. If it breaks, the panel shows "no transcript".

## Development

```sh
pnpm install
pnpm dev        # run the extension with hot reload
pnpm test       # unit tests
pnpm check      # lint and format (Biome)
pnpm typecheck
pnpm build
pnpm zip        # package into .output/
```

## Tech stack

- [WXT](https://wxt.dev) for the extension framework
- React 19 and TypeScript
- Tailwind CSS v4 and shadcn/ui
- Vercel AI SDK and AI Elements
- Biome for lint and format
- Vitest for tests

## License

See [LICENSE](LICENSE).
