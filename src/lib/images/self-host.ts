import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { MAX_SOURCE_BYTES, optimizeImageBuffer } from '@/lib/images/optimize'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])

/**
 * Télécharge une image distante et la self-host dans un bucket Supabase Storage
 * (même logique que le pipeline refresh-images : valide content-type + taille,
 * upsert, cache-buster `?v=`). Depuis le round 2026-07-18 la source est
 * NORMALISÉE (≤ maxSide px, webp q80) — jamais l'original brut : 814 objets
 * surdimensionnés (max 17 Mo) cassaient l'affichage via Cloudinary fetch.
 * Service-role. Renvoie l'URL publique ou `{error}`.
 */
export async function selfHostImage(
  sourceUrl: string,
  bucket: string,
  idBase: string,
  opts: { maxSide?: number } = {},
): Promise<{ url: string } | { error: string }> {
  let res: Response
  try {
    res = await fetch(sourceUrl, { headers: { 'User-Agent': UA } })
  } catch {
    return { error: 'Could not fetch the image URL.' }
  }
  if (!res.ok) return { error: `Fetch failed (${res.status}).` }
  const type = res.headers.get('content-type')?.split(';')[0].trim() ?? ''
  if (!IMAGE_TYPES.has(type)) return { error: `Not an image (${type || 'unknown type'}).` }
  const declaredLength = Number(res.headers.get('content-length') ?? 0)
  if (declaredLength > MAX_SOURCE_BYTES) return { error: 'Image too large (>10 MB).' }
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.byteLength < 1024) return { error: 'Image too small or invalid.' }

  let optimized: Buffer
  try {
    optimized = await optimizeImageBuffer(buf, opts)
  } catch (e) {
    return { error: `Image could not be processed (${String(e)}).` }
  }

  const admin = createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const path = `${idBase}.webp`
  const { error: upErr } = await admin.storage
    .from(bucket)
    .upload(path, optimized, { upsert: true, contentType: 'image/webp' })
  if (upErr) return { error: 'Upload failed.' }
  const { data: pub } = admin.storage.from(bucket).getPublicUrl(path)
  return { url: `${pub.publicUrl}?v=${Date.now()}` }
}
