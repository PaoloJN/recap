import { mkdir } from "node:fs/promises"
import sharp from "sharp"

const PATHS = [
  "M0 30H30V90H0V30Z",
  "M60 60H90V90H60V60Z",
  "M90 0L30 60H60V34H90V0Z",
  "M30 0H60V30H30V0Z",
]
const SIZES = [16, 32, 48, 96, 128]

function svg(size) {
  const scale = (size * 0.6) / 90
  const offset = (size - 90 * scale) / 2
  const paths = PATHS.map((d) => `<path d="${d}"/>`).join("")
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" rx="${size * 0.22}" fill="#0f0f0f"/><g transform="translate(${offset} ${offset}) scale(${scale})" fill="#f1f1f1">${paths}</g></svg>`
}

await mkdir("public/icon", { recursive: true })
for (const size of SIZES) {
  await sharp(Buffer.from(svg(size)), { density: 384 })
    .resize(size, size)
    .png()
    .toFile(`public/icon/${size}.png`)
}
