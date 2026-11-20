import { spawn } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { mkdir, stat } from "node:fs/promises"
import { createServer } from "node:http"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright-core"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const dist = path.join(root, "dist-preview")
const sample = path.join(dist, "sample.mp4")
const artifactDir = "/opt/cursor/artifacts"
const screenshot = path.join(artifactDir, "diagram-panel.png")
const chrome = [
  "/opt/google/chrome/chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/local/bin/google-chrome",
].find((candidate) => existsSync(candidate))

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" })
    child.on("error", reject)
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)),
    )
  })
}

function contentType(file) {
  if (file.endsWith(".html")) return "text/html; charset=utf-8"
  if (file.endsWith(".js")) return "text/javascript; charset=utf-8"
  if (file.endsWith(".css")) return "text/css; charset=utf-8"
  if (file.endsWith(".svg")) return "image/svg+xml"
  if (file.endsWith(".mp4")) return "video/mp4"
  return "application/octet-stream"
}

function serve(dir) {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1")
    const rel = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname)
    const file = path.resolve(dir, `.${rel.startsWith("/") ? rel : `/${rel}`}`)
    if (!file.startsWith(dir) || !existsSync(file)) {
      res.writeHead(404)
      res.end()
      return
    }
    const data = readFileSync(file)
    const type = contentType(file)
    const match =
      typeof req.headers.range === "string" ? /bytes=(\d+)-(\d*)/.exec(req.headers.range) : null
    if (match) {
      const start = Number(match[1])
      const end = match[2] ? Number(match[2]) : data.length - 1
      const chunk = data.subarray(start, end + 1)
      res.writeHead(206, {
        "content-type": type,
        "accept-ranges": "bytes",
        "content-range": `bytes ${start}-${end}/${data.length}`,
        "content-length": chunk.length,
      })
      res.end(chunk)
      return
    }
    res.writeHead(200, {
      "content-type": type,
      "accept-ranges": "bytes",
      "content-length": data.length,
    })
    res.end(data)
  })
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (!address || typeof address === "string") throw new Error("no port")
      resolve({ server, port: address.port })
    })
  })
}

if (!chrome) throw new Error("Chrome was not found")
const pagePath = "/src/preview/index.html"
if (!existsSync(path.join(dist, "src/preview/index.html"))) {
  throw new Error("dist-preview is missing. Run pnpm verify:diagram from the repo root.")
}

await mkdir(artifactDir, { recursive: true })
await run("ffmpeg", [
  "-y",
  "-loglevel",
  "error",
  "-f",
  "lavfi",
  "-i",
  "testsrc=size=160x90:rate=15:duration=70",
  "-movflags",
  "+faststart",
  "-pix_fmt",
  "yuv420p",
  "-c:v",
  "libx264",
  "-g",
  "15",
  sample,
])

const { server, port } = await serve(dist)
const browser = await chromium.launch({
  executablePath: chrome,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
})

try {
  const page = await browser.newPage({
    viewport: { width: 520, height: 980 },
    deviceScaleFactor: 2,
  })
  await page.goto(`http://127.0.0.1:${port}${pagePath}`, { waitUntil: "networkidle" })
  await page.getByTestId("diagram-status").getByText("ready").waitFor({ timeout: 20000 })
  const svgText = (await page.getByTestId("diagram-svg").textContent()) ?? ""
  if (!svgText.includes("API Gateway") || !svgText.includes("Trình duyệt")) {
    throw new Error(`Diagram text missing labels: ${svgText}`)
  }
  const player = page.getByTestId("player")
  const ready = await player.evaluate(
    (video) =>
      new Promise((resolve) => {
        const done = () => {
          const end = video.seekable.length ? video.seekable.end(0) : 0
          if (end >= 28) {
            resolve({ seekableEnd: end, readyState: video.readyState })
          }
        }
        video.addEventListener("progress", done)
        video.addEventListener("loadedmetadata", done)
        video.addEventListener("canplay", done)
        done()
        setTimeout(
          () =>
            resolve({
              seekableEnd: video.seekable.length ? video.seekable.end(0) : 0,
              readyState: video.readyState,
              timedOut: true,
            }),
          4000,
        )
      }),
  )
  if (ready.timedOut) throw new Error(`Player never became seekable: ${JSON.stringify(ready)}`)
  await page.getByTestId("diagram-link").filter({ hasText: "Worker" }).click()
  const jumped = await page.getByRole("status").textContent()
  if (jumped !== "Jumped to 0:28") throw new Error(`Unexpected seek toast: ${jumped}`)
  const currentTime = await player.evaluate((video) => video.currentTime)
  if (Math.abs(currentTime - 28) > 0.5)
    throw new Error(`Player did not seek, currentTime=${currentTime}`)
  await page.getByTestId("diagram-panel").screenshot({ path: screenshot })
  const info = await stat(screenshot)
  if (info.size < 5000) throw new Error(`Screenshot looks empty (${info.size} bytes)`)
  console.log(`Saved ${screenshot} (${info.size} bytes)`)
} finally {
  await browser.close()
  server.close()
}
