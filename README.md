# Recap AI

Recap AI for YouTube: summaries, a searchable transcript and chat about the video, in the sidebar, powered by your own OpenAI, Anthropic, Google or OpenRouter key.

![Screenshot](assets/screenshot.png)

## Features

- Structured summary with key moments, notes, a plain-terms paragraph and a "current moment" marker that follows playback. Styles: Detailed, TL;DR and Key moments. Summaries stay on the main ideas.
- Sơ đồ tab: one click draws a Mermaid diagram of the architecture, flow, or main concepts, rendered in the panel (not as raw code). Labels follow the answer language and keep English technical terms. Rows under the diagram seek the video. Copy the Mermaid source, download an SVG, or include the diagram in the Markdown export.
- Chapter bar under the header, synced to playback. Click a segment to jump. Videos without chapters get a single bar.
- Transcript that works without a key: search, follow playback, click to jump, chapter headers, copy.
- Chat with quotes from the transcript, a "Current moment" toggle, citation chips that seek the video, and per-video history.
- Starter questions generated from the summary.
- Bring your own key for OpenAI, Anthropic, Google or OpenRouter, with a model picker. The key is tested in the panel before it is saved. Or sign in with a ChatGPT subscription (no API key; uses your plan limits).
- Usage counters for the month (tokens, summaries, chats).
- Auto-summarize (off by default), filler-word stripping, answer language and custom instructions. A fresh install answers in Tiếng Việt; change it under Settings → Answer language.
- Text size (S, M, L) and theme (follow YouTube, dark or light).
- Export a video's summary and chat as Markdown, or all chats in one file.
- Shortcuts: `Alt+Y` toggle panel, `Alt+C` focus chat, `Alt+S` summarize, `Alt+F` search transcript. `Alt+Y` can be rebound at `chrome://extensions/shortcuts`.

## Install

From a release:

1. Download the zip from the [latest GitHub Release](https://github.com/PaoloJN/recap/releases/latest).
2. Unzip it.
3. Open `chrome://extensions` and turn on Developer mode.
4. Click Load unpacked and select the unzipped folder.

Or build from source, as described under Development, and load `.output/chrome-mv3` the same way.

## Setup

1. Open a YouTube video. The card shows "Add a key".
2. Click Add API key and pick a provider.
3. Paste your key and click Test key.
4. Click Save and continue.

Get a key here:

- OpenAI: https://platform.openai.com/api-keys
- Anthropic: https://platform.claude.com/settings/keys
- Google: https://aistudio.google.com/apikey
- OpenRouter: https://openrouter.ai/settings/keys

The transcript tab works without a key.

## ChatGPT (subscription)

Settings → Provider → **ChatGPT (subscription)** → **Đăng nhập ChatGPT**. A normal tab opens OpenAI's Sign in with ChatGPT page. Recap reads the loopback redirect (`http://127.0.0.1:1455/auth/callback`) with `webNavigation`; it does not listen on a port. The model list comes from `GET /v1/models`. If that list is empty, type a model id.

**Đăng xuất** deletes the access token and refresh token from `chrome.storage.local` on this device. The issued client id stays so the next sign-in is recognized as the same install. To revoke the grant at OpenAI, disconnect Recap from the connected apps on your ChatGPT account.

This login is a preview. It is for personal use of this extension only, not a general API proxy. Requests consume the same ChatGPT plan limits as ChatGPT itself (there is no extra quota). Tokens are never synced and never sent to the page.

## Cài đặt và tab Sơ đồ

Bản fork này mặc định trả lời bằng tiếng Việt (đổi được trong Settings). Tab **Sơ đồ** vẽ một sơ đồ Mermaid từ transcript: nhãn theo ngôn ngữ trả lời, thuật ngữ kỹ thuật tiếng Anh giữ nguyên (API Gateway, Kafka, Redis, …). Không có backend; khóa API nằm trong `chrome.storage.local`.

### Build

Từ thư mục gốc của repo:

```sh
pnpm install
pnpm build
```

Lệnh build là `pnpm build` (WXT). Thư mục để nạp vào Chrome là `.output/chrome-mv3` (nằm ngay trong repo sau khi build xong).

### Cài unpacked trên Chrome

1. Mở `chrome://extensions`.
2. Bật **Developer mode**.
3. Chọn **Load unpacked**.
4. Trỏ tới thư mục `.output/chrome-mv3` (không chọn cả repo, không chọn file zip).

### ChatGPT (gói đăng ký)

1. Settings → Provider → **ChatGPT (subscription)** → **Đăng nhập ChatGPT**.
2. Đăng nhập trên tab OpenAI. Extension đọc URL chuyển hướng `127.0.0.1:1455`, không mở cổng localhost.
3. Chọn model (danh sách từ tài khoản). Nếu danh sách trống, nhập model id.
4. **Đăng xuất** xóa access token và refresh token trên máy. Để thu hồi phía OpenAI, gỡ Recap khỏi ứng dụng đã kết nối của tài khoản ChatGPT.
5. Chỉ dùng cá nhân cho extension này. Lượt gọi trừ vào hạn mức ChatGPT (không có quota riêng). Đây là tính năng preview.

### OpenRouter và tiếng Việt

1. Mở một video YouTube. Trên thẻ bấm **Add API key**.
2. Provider: **OpenRouter**. Dán khóa từ https://openrouter.ai/settings/keys (dạng `sk-or-…`).
3. Bấm **Test key**, rồi **Save and continue**.
4. Cài mới thì ngôn ngữ trả lời đã là **Tiếng Việt**. Đổi tại Settings → **Answer language** (áp dụng cho tóm tắt, sơ đồ và chat). Tóm tắt chỉ giữ ý chính, bỏ lời chào và đoạn tài trợ.

### Dùng tab Sơ đồ

1. Mở video có phụ đề (transcript).
2. Mở panel, chọn tab **Sơ đồ**, bấm **Draw diagram**.
3. Sơ đồ hiện thành hình trong panel. Danh sách bên dưới (thành phần → mốc thời gian) tua video khi bấm, cùng cơ chế tua với các timestamp khác.
4. **Copy Mermaid** chép mã nguồn. **Download SVG** tải file ảnh. Menu **Export as Markdown** gắn sơ đồ vào file export nếu video đã có sơ đồ.
5. Nếu Mermaid không parse được, extension hỏi model sửa cú pháp một lần. Vẫn lỗi thì panel hiện thông báo và mã thô.

### Gỡ cài đặt

1. Mở `chrome://extensions`.
2. Tìm **Recap AI** và bấm **Remove**.
3. Khóa API, tóm tắt, sơ đồ và chat lưu trên máy sẽ mất cùng extension. Không có tài khoản để xóa ở server.

## Privacy

- Your key is stored in `chrome.storage.local` on your device and sent only to the provider you pick. A ChatGPT subscription stores its tokens the same way, only in the background service worker.
- Requests go only to YouTube and the provider you chose. There is no server of ours in between.
- No analytics, no telemetry, no tracking.
- Transcripts come from YouTube's own transcript feature. It is undocumented and may change. If it breaks, the panel shows "no transcript".

## Development

```sh
pnpm install
pnpm dev        # run the extension with hot reload
pnpm test       # unit tests
pnpm check      # lint and format (Biome)
pnpm typecheck
pnpm build
pnpm verify:diagram  # headless render check; needs Chrome and ffmpeg
pnpm zip        # package into .output/
pnpm icons      # regenerate extension icons
```

## Tech stack

- [WXT](https://wxt.dev) for the extension framework
- React 19 and TypeScript
- Tailwind CSS v4 and shadcn/ui
- Phosphor icons
- Vercel AI SDK and Streamdown
- Biome for lint and format
- Vitest for tests

## License

See [LICENSE](LICENSE).
