import sharp from 'sharp'

// Plafond SOURCE : Cloudinary fetch (tier free) refuse ~10 Mo — au-delà,
// l'image self-hostée est « cassée » à l'affichage (cas SuA 17 Mo, round
// 2026-07-18). On refuse donc avant le bucket, jamais après.
export const MAX_SOURCE_BYTES = 10 * 1024 * 1024
// Côté long max par défaut : les photos membres/groupes s'affichent ≤ 600 px
// (faceCrop) — 800 px garde une marge retina sans stocker l'original fandom.
export const DEFAULT_MAX_SIDE = 800
const WEBP_QUALITY = 80

/**
 * Normalise un buffer image avant self-host : orientation EXIF appliquée,
 * redimensionné à `maxSide` max (jamais agrandi), ré-encodé webp q80.
 * Jette si la source dépasse MAX_SOURCE_BYTES ou n'est pas décodable.
 */
export async function optimizeImageBuffer(
  input: ArrayBuffer | Buffer,
  opts: { maxSide?: number; maxSourceBytes?: number } = {},
): Promise<Buffer> {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input)
  // `maxSourceBytes` relevable UNIQUEMENT pour retraiter nos propres objets
  // déjà en bucket (reprocess) — les fetches externes gardent le cap 10 Mo.
  const cap = opts.maxSourceBytes ?? MAX_SOURCE_BYTES
  if (buf.byteLength > cap) {
    throw new Error(`image source ${(buf.byteLength / 1_000_000).toFixed(1)} MB > cap 10 MB`)
  }
  const maxSide = opts.maxSide ?? DEFAULT_MAX_SIDE
  return sharp(buf)
    .rotate()
    .resize(maxSide, maxSide, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer()
}
