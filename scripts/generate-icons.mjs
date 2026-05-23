// One-shot icon generator. Run when icons need regeneration.
// Usage: node scripts/generate-icons.mjs
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const sizes = [192, 512]
const bg = '#0a0a0a'
const fg = '#ffffff'
const outDir = path.resolve('public/icons')

await mkdir(outDir, { recursive: true })

for (const size of sizes) {
  const fontSize = Math.round(size * 0.42)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="100%" height="100%" fill="${bg}"/>
    <text x="50%" y="50%" fill="${fg}" font-family="system-ui, -apple-system, Segoe UI, sans-serif"
          font-weight="700" font-size="${fontSize}"
          text-anchor="middle" dominant-baseline="central">KS</text>
  </svg>`
  await sharp(Buffer.from(svg))
    .png()
    .toFile(path.join(outDir, `icon-${size}.png`))
  console.log(`✓ icon-${size}.png`)
}
