// One-shot icon generator. Run when icons need regeneration.
// Usage: node scripts/generate-icons.mjs
// Renders the branded "K" mark (gradient bg, cf. src/app/icon.svg) full-bleed
// so Android maskable icons keep no transparent corners. iOS rounds the
// apple-icon itself, so full-bleed is correct there too.
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const targets = [
  { size: 192, out: 'public/icons/icon-192.png' },
  { size: 512, out: 'public/icons/icon-512.png' },
  { size: 180, out: 'src/app/apple-icon.png' },
]

const markup = (
  size,
) => `<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="k" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8b5cff" />
      <stop offset="1" stop-color="#ff2d87" />
    </linearGradient>
  </defs>
  <rect width="100" height="100" fill="url(#k)" />
  <path d="M34 24 V76" fill="none" stroke="#fff" stroke-width="13" stroke-linecap="round" />
  <path d="M70 24 L42 50 L72 76" fill="none" stroke="#fff" stroke-width="13" stroke-linecap="round" stroke-linejoin="round" />
</svg>`

for (const { size, out } of targets) {
  const file = path.resolve(out)
  await mkdir(path.dirname(file), { recursive: true })
  await sharp(Buffer.from(markup(size)))
    .png()
    .toFile(file)
  console.log(`✓ ${out}`)
}
