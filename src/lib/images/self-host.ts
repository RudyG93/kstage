import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
}

/**
 * Télécharge une image distante et la self-host dans un bucket Supabase Storage
 * (même logique que le pipeline refresh-images : valide content-type + taille,
 * upsert, cache-buster `?v=`). Service-role. Renvoie l'URL publique ou `{error}`.
 */
export async function selfHostImage(
  sourceUrl: string,
  bucket: string,
  idBase: string,
): Promise<{ url: string } | { error: string }> {
  let res: Response
  try {
    res = await fetch(sourceUrl, { headers: { 'User-Agent': UA } })
  } catch {
    return { error: 'Could not fetch the image URL.' }
  }
  if (!res.ok) return { error: `Fetch failed (${res.status}).` }
  const type = res.headers.get('content-type')?.split(';')[0].trim() ?? ''
  const ext = EXT_BY_TYPE[type]
  if (!ext) return { error: `Not an image (${type || 'unknown type'}).` }
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.byteLength < 1024) return { error: 'Image too small or invalid.' }

  const admin = createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const path = `${idBase}.${ext}`
  const { error: upErr } = await admin.storage
    .from(bucket)
    .upload(path, buf, { upsert: true, contentType: type })
  if (upErr) return { error: 'Upload failed.' }
  const { data: pub } = admin.storage.from(bucket).getPublicUrl(path)
  return { url: `${pub.publicUrl}?v=${Date.now()}` }
}
