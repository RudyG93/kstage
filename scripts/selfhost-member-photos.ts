/**
 * Self-host des photos membres (R4, décision 2026-07-05) : télécharge chaque
 * `members.photo_url` externe (kprofiles, up.kpop.re, Spotify CDN…) dans le
 * bucket public Supabase Storage `member-photos`, puis pointe `photo_url` vers
 * l'URL publique du Storage. Élimine le risque hotlinking ET le besoin de
 * re-scrape fraîcheur. À lancer APRÈS scripts/clean-member-photos.ts.
 *
 * Idempotent : les URLs déjà sur notre Storage sont ignorées ; l'upload est en
 * upsert par `<member_id>.<ext>` (re-run sans doublon). Téléchargement direct
 * avec UA navigateur, repli via le proxy Cloudinary (certains hosts bloquent).
 *
 *   npx tsx scripts/selfhost-member-photos.ts            (dry-run : liste)
 *   npx tsx scripts/selfhost-member-photos.ts --write    (télécharge + upload)
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database'

loadEnvConfig(process.cwd())
const WRITE = process.argv.includes('--write')
const BUCKET = 'member-photos'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
}

async function download(url: string): Promise<{ bytes: ArrayBuffer; type: string } | null> {
  // 1) direct avec UA navigateur ; 2) repli proxy Cloudinary (hosts anti-hotlink).
  const candidates = [url]
  if (CLOUD)
    candidates.push(
      `https://res.cloudinary.com/${CLOUD}/image/fetch/w_800,f_jpg,q_auto/${encodeURIComponent(url)}`,
    )
  for (const u of candidates) {
    try {
      const r = await fetch(u, { headers: { 'User-Agent': UA } })
      const type = r.headers.get('content-type')?.split(';')[0].trim() ?? ''
      if (r.ok && type.startsWith('image/')) {
        const bytes = await r.arrayBuffer()
        if (bytes.byteLength > 1024) return { bytes, type }
      }
    } catch {
      // essaie le candidat suivant
    }
  }
  return null
}

async function main() {
  // Bucket public (lecture via URL publique CDN, pas de policy SELECT requise —
  // même modèle que avatars/banners, cf. migration 0035).
  const { data: buckets } = await supabase.storage.listBuckets()
  if (!buckets?.some((b) => b.name === BUCKET)) {
    console.log(`${WRITE ? 'CREATE' : '[dry] CREATE'} bucket public ${BUCKET}`)
    if (WRITE) {
      const { error } = await supabase.storage.createBucket(BUCKET, { public: true })
      if (error) throw error
    }
  }

  const { data: members, error } = await supabase
    .from('members')
    .select('id, stage_name, photo_url, groups!inner(slug)')
    .not('photo_url', 'is', null)
  if (error) throw error

  const targets = (members ?? []).filter(
    (m) => !m.photo_url!.includes(`/storage/v1/object/public/${BUCKET}/`),
  )
  console.log(`${targets.length} photo(s) externe(s) à rapatrier (sur ${members?.length ?? 0}).`)
  if (!WRITE) {
    const hosts = new Map<string, number>()
    for (const m of targets) {
      const h = new URL(m.photo_url!).hostname
      hosts.set(h, (hosts.get(h) ?? 0) + 1)
    }
    console.log('Par host:', Object.fromEntries(hosts))
    console.log('Dry-run — relance avec --write pour appliquer.')
    return
  }

  let ok = 0
  let failed = 0
  for (const m of targets) {
    const src = m.photo_url!
    const dl = await download(src)
    if (!dl) {
      console.log(`✖ ${m.groups?.slug}/${m.stage_name} — téléchargement impossible: ${src}`)
      failed++
      continue
    }
    const ext = EXT_BY_TYPE[dl.type] ?? 'jpg'
    const path = `${m.id}.${ext}`
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, dl.bytes, { contentType: dl.type, upsert: true })
    if (upErr) {
      console.log(`✖ ${m.groups?.slug}/${m.stage_name} — upload: ${upErr.message}`)
      failed++
      continue
    }
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
    const { error: dbErr } = await supabase
      .from('members')
      .update({ photo_url: pub.publicUrl })
      .eq('id', m.id)
    if (dbErr) {
      console.log(`✖ ${m.groups?.slug}/${m.stage_name} — update DB: ${dbErr.message}`)
      failed++
      continue
    }
    ok++
    if (ok % 25 === 0) console.log(`… ${ok}/${targets.length}`)
    await sleep(120)
  }
  console.log(`\nRésumé: ${ok} rapatriée(s), ${failed} échec(s) (photo_url d'origine conservée).`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
