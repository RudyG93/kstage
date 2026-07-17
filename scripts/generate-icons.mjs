// One-shot icon generator. Run when icons need regeneration.
// Usage: node scripts/generate-icons.mjs
// Renders the branded "K" mark (gradient bg, cf. src/app/icon.svg) full-bleed
// so Android maskable icons keep no transparent corners. iOS rounds the
// apple-icon itself, so full-bleed is correct there too.
import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const targets = [
  { size: 192, out: 'public/icons/icon-192.png' },
  { size: 512, out: 'public/icons/icon-512.png' },
  { size: 180, out: 'src/app/apple-icon.png' },
  // Badge Android : SILHOUETTE monochrome (blanc sur transparent) — un badge
  // couleur est aplati en gris illisible dans la barre de statut.
  { size: 96, out: 'public/icons/badge-96.png', badge: true },
]

const badgeMarkup = (
  size,
) => `<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <path d="M34 24 V76" fill="none" stroke="#fff" stroke-width="15" stroke-linecap="round" />
  <path d="M70 24 L42 50 L72 76" fill="none" stroke="#fff" stroke-width="15" stroke-linecap="round" stroke-linejoin="round" />
</svg>`

const markup = (
  size,
) => `<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="k" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#5b5bf0" />
      <stop offset="1" stop-color="#3fe0b8" />
    </linearGradient>
  </defs>
  <rect width="100" height="100" fill="url(#k)" />
  <path d="M34 24 V76" fill="none" stroke="#fff" stroke-width="13" stroke-linecap="round" />
  <path d="M70 24 L42 50 L72 76" fill="none" stroke="#fff" stroke-width="13" stroke-linecap="round" stroke-linejoin="round" />
</svg>`

for (const { size, out, badge } of targets) {
  const file = path.resolve(out)
  await mkdir(path.dirname(file), { recursive: true })
  await sharp(Buffer.from((badge ? badgeMarkup : markup)(size)))
    .png()
    .toFile(file)
  console.log(`✓ ${out}`)
}

// favicon.ico : Safari macOS ignore les favicons SVG et les crawlers/unfurlers
// GET /favicon.ico en aveugle (404 en prod avant ça). Conteneur ICO à entrées
// PNG (16/32/48) — supporté par tous les navigateurs actuels.
const icoSizes = [16, 32, 48]
const pngs = await Promise.all(
  icoSizes.map((size) =>
    sharp(Buffer.from(markup(size)))
      .png()
      .toBuffer(),
  ),
)
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0) // réservé
header.writeUInt16LE(1, 2) // type 1 = icône
header.writeUInt16LE(pngs.length, 4)
const entries = []
let offset = 6 + 16 * pngs.length
pngs.forEach((png, i) => {
  const entry = Buffer.alloc(16)
  entry.writeUInt8(icoSizes[i] === 256 ? 0 : icoSizes[i], 0) // largeur
  entry.writeUInt8(icoSizes[i] === 256 ? 0 : icoSizes[i], 1) // hauteur
  entry.writeUInt8(0, 2) // palette
  entry.writeUInt8(0, 3) // réservé
  entry.writeUInt16LE(1, 4) // plans
  entry.writeUInt16LE(32, 6) // bits/pixel
  entry.writeUInt32LE(png.length, 8)
  entry.writeUInt32LE(offset, 12)
  entries.push(entry)
  offset += png.length
})
const icoPath = path.resolve('src/app/favicon.ico')
await writeFile(icoPath, Buffer.concat([header, ...entries, ...pngs]))
console.log(`✓ src/app/favicon.ico`)
