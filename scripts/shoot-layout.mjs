import { existsSync } from "node:fs"
import { mkdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright-core"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const pagePath = path.join(root, "prototype/watch-layout.html")
const outDir = "/opt/cursor/artifacts"
const chrome = [
  "/opt/google/chrome/chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/local/bin/google-chrome",
].find((candidate) => existsSync(candidate))

if (!chrome) throw new Error("Chrome not found")

const browser = await chromium.launch({
  executablePath: chrome,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
})
const page = await browser.newPage()
await mkdir(outDir, { recursive: true })

const shots = [
  [1440, 900],
  [1920, 1080],
]
for (const [width, height] of shots) {
  await page.setViewportSize({ width, height })
  for (const shot of ["default", "wide", "focus"]) {
    await page.goto(`file://${pagePath}?shot=${shot}`)
    await page.waitForSelector("#panel")
    const file = path.join(outDir, `layout-${width}-${shot}.png`)
    await page.screenshot({ path: file })
    console.log(file)
  }
}

await page.setViewportSize({ width: 1440, height: 900 })
await page.goto(`file://${pagePath}`)
const before = await page.evaluate(() =>
  getComputedStyle(document.documentElement).getPropertyValue("--panel"),
)
const handle = page.locator("#handle")
const box = await handle.boundingBox()
if (!box) throw new Error("handle missing")
await page.mouse.move(box.x + box.width / 2, box.y + 80)
await page.mouse.down()
await page.mouse.move(box.x - 280, box.y + 80, { steps: 12 })
await page.mouse.up()
const dragged = Number.parseFloat(
  await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--panel")),
)
if (!(dragged > Number.parseFloat(before) + 200)) {
  throw new Error(`drag did not widen the panel (${before} -> ${dragged})`)
}
await handle.dblclick()
const reset = Number.parseFloat(
  await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--panel")),
)
if (reset !== 400) throw new Error(`double-click reset to ${reset}`)
await page.locator("#focus").click()
const focused = await page.evaluate(() => {
  const primary = document.getElementById("primary").getBoundingClientRect().width
  const columns = document.getElementById("columns").getBoundingClientRect().width
  const probe = document.createElement("div")
  probe.style.cssText = "position:absolute;width:75ch;visibility:hidden"
  document.body.append(probe)
  const expected = probe.getBoundingClientRect().width
  probe.remove()
  const maxWidth = getComputedStyle(document.querySelector(".thread")).maxWidth
  return {
    on: document.documentElement.classList.contains("focus"),
    split: primary / columns,
    maxWidth,
    expected,
  }
})
if (!focused.on) throw new Error("focus mode did not turn on")
if (Math.abs(focused.split - 0.4) > 0.08) throw new Error(`player column is ${focused.split}`)
const actualMax = Number.parseFloat(focused.maxWidth)
if (focused.maxWidth !== "75ch" && Math.abs(actualMax - focused.expected) > 2) {
  throw new Error(`reading width is ${focused.maxWidth}, expected ~${focused.expected}`)
}
await page.keyboard.press("Escape")
if (await page.evaluate(() => document.documentElement.classList.contains("focus"))) {
  throw new Error("Escape did not leave focus mode")
}
const ratio = await page.evaluate(() => {
  const stage = document.querySelector(".stage")
  const rect = stage.getBoundingClientRect()
  return rect.width / rect.height
})
if (Math.abs(ratio - 16 / 9) > 0.05) throw new Error(`player ratio ${ratio}`)
console.log("interactions ok", { before, dragged, reset, ratio })
await browser.close()
