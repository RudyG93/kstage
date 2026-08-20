import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Upload webp + vérification d'intégrité post-upload.
 *
 * Incident 2026-08-20 : 180 objets uploadés depuis les crons Vercel (~24
 * juillet et après) portaient des octets U+FFFD (EF BF BD) dans le header
 * RIFF — un round-trip binaire→texte quelque part dans la couche upload de
 * l'environnement runtime (le même code en local produit des fichiers
 * valides). Les objets étaient servis HTTP 200 mais rejetés par les
 * navigateurs et Cloudinary (« Invalid image file ») → avatars/vignettes
 * cassés silencieusement pendant des semaines.
 *
 * Défense : après chaque upload, relire l'objet STOCKÉ et valider la
 * signature RIFF/WEBP ; un retry, sinon échec franc — jamais d'URL en DB
 * vers un objet corrompu. La relecture passe par storage.download() (API
 * directe) : un GET public taperait le cache CDN, qui sert encore
 * l'ancienne version après un upsert même-chemin.
 */
export async function uploadWebpVerified(
  client: SupabaseClient<Database>,
  bucket: string,
  path: string,
  optimized: Buffer,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let lastError = 'Upload failed.'
  for (let attempt = 0; attempt < 2; attempt++) {
    const { error: upErr } = await client.storage
      .from(bucket)
      .upload(path, optimized, { upsert: true, contentType: 'image/webp' })
    if (upErr) {
      lastError = upErr.message
      continue
    }
    const { data: blob, error: dlErr } = await client.storage.from(bucket).download(path)
    if (dlErr || !blob) {
      lastError = dlErr?.message ?? 'Download-back failed.'
      continue
    }
    const head = Buffer.from(await blob.slice(0, 16).arrayBuffer())
    if (isValidWebpHeader(head)) return { ok: true }
    lastError = `Stored object failed WEBP integrity check [${head.toString('hex')}].`
  }
  return { ok: false, error: lastError }
}

/** Signature RIFF????WEBP sur les 16 premiers octets. */
export function isValidWebpHeader(head: Buffer): boolean {
  return (
    head.length >= 12 &&
    head.subarray(0, 4).toString('latin1') === 'RIFF' &&
    head.subarray(8, 12).toString('latin1') === 'WEBP'
  )
}
