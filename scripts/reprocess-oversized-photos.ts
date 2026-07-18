// Re-traite les objets Storage SURDIMENSIONNÉS des buckets self-hostés
// (member-photos, group-photos) : les pipelines stockaient l'original fandom
// brut (max constaté : 17,2 Mo pour un avatar — Cloudinary fetch refuse >10 Mo
// → image cassée à l'affichage, cas SuA round 2026-07-18).
//
// Pour chaque objet > --threshold (défaut 400 Ko) RÉFÉRENCÉ par une row :
//   download → optimizeImageBuffer (≤800 px, webp q80) → upload `<base>.webp`
//   → update photo_url/image_url (+ ?v= cache-bust) → suppression de l'ancien
//   objet si l'extension change. Les orphelins (non référencés) sont comptés
//   mais jamais touchés.
//
//   npx tsx scripts/reprocess-oversized-photos.ts                (dry-run)
//   npx tsx scripts/reprocess-oversized-photos.ts --apply
//   npx tsx scripts/reprocess-oversized-photos.ts --apply --bucket=group-photos
//   npx tsx scripts/reprocess-oversized-photos.ts --apply --threshold=1000000
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database'
import { optimizeImageBuffer } from '../src/lib/images/optimize'

loadEnvConfig(process.cwd())

const APPLY = process.argv.includes('--apply')
const ONLY_BUCKET = process.argv.find((a) => a.startsWith('--bucket='))?.slice(9) ?? null
const THRESHOLD = Number(
  process.argv.find((a) => a.startsWith('--threshold='))?.slice(12) ?? '400000',
)

type BucketJob = {
  bucket: string
  table: 'members' | 'groups'
  urlColumn: 'photo_url' | 'image_url'
}

const JOBS: BucketJob[] = [
  { bucket: 'member-photos', table: 'members', urlColumn: 'photo_url' },
  { bucket: 'group-photos', table: 'groups', urlColumn: 'image_url' },
]

/** Nom d'objet référencé par une URL publique du bucket (`.../bucket/<name>?v=`). */
function objectNameFromUrl(url: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`
  const i = url.indexOf(marker)
  if (i === -1) return null
  const rest = url.slice(i + marker.length)
  return decodeURIComponent(rest.split('?')[0])
}

async function listAllObjects(supabase: ReturnType<typeof createClient<Database>>, bucket: string) {
  const all: { name: string; size: number }[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(bucket).list('', { limit: 1000, offset })
    if (error) throw new Error(`list ${bucket}: ${error.message}`)
    for (const o of data ?? []) {
      const size = (o.metadata as { size?: number } | null)?.size ?? 0
      all.push({ name: o.name, size })
    }
    if (!data || data.length < 1000) break
  }
  return all
}

async function main() {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  for (const job of JOBS) {
    if (ONLY_BUCKET && job.bucket !== ONLY_BUCKET) continue
    console.log(`\n=== ${job.bucket} (seuil ${Math.round(THRESHOLD / 1000)} Ko) ===`)

    const objects = await listAllObjects(supabase, job.bucket)
    const oversized = objects.filter((o) => o.size > THRESHOLD)

    // Rows référençant le bucket (≤ ~850 rows — sous le cap select 1000).
    const { data: rows, error: rowErr } = await supabase
      .from(job.table)
      .select(`id, ${job.urlColumn}`)
      .like(job.urlColumn, `%/${job.bucket}/%`)
    if (rowErr) throw new Error(`${job.table} select: ${rowErr.message}`)
    const rowByObject = new Map<string, string>()
    for (const r of (rows ?? []) as unknown as { id: string; [k: string]: string | null }[]) {
      const url = r[job.urlColumn]
      const name = url ? objectNameFromUrl(url, job.bucket) : null
      if (name) rowByObject.set(name, r.id)
    }

    let processed = 0
    let failures = 0
    let orphans = 0
    let savedBytes = 0

    for (const obj of oversized) {
      const rowId = rowByObject.get(obj.name)
      if (!rowId) {
        orphans++
        continue
      }
      if (!APPLY) {
        processed++
        console.log(`[dry] ${obj.name} (${(obj.size / 1e6).toFixed(2)} Mo) → ${job.table} ${rowId}`)
        continue
      }
      try {
        const { data: blob, error: dlErr } = await supabase.storage
          .from(job.bucket)
          .download(obj.name)
        if (dlErr || !blob) throw new Error(dlErr?.message ?? 'download vide')
        // Nos propres objets peuvent dépasser le cap fetch de 10 Mo (c'est
        // précisément ce qu'on répare) — cap relevé pour le reprocess.
        const optimized = await optimizeImageBuffer(await blob.arrayBuffer(), {
          maxSourceBytes: 64 * 1024 * 1024,
        })
        const base = obj.name.replace(/\.[a-z0-9]+$/i, '')
        const newName = `${base}.webp`
        const { error: upErr } = await supabase.storage
          .from(job.bucket)
          .upload(newName, optimized, { contentType: 'image/webp', upsert: true })
        if (upErr) throw new Error(`upload: ${upErr.message}`)
        const { data: pub } = supabase.storage.from(job.bucket).getPublicUrl(newName)
        const newUrl = `${pub.publicUrl}?v=${Date.now()}`
        const { error: dbErr } =
          job.table === 'members'
            ? await supabase.from('members').update({ photo_url: newUrl }).eq('id', rowId)
            : await supabase.from('groups').update({ image_url: newUrl }).eq('id', rowId)
        if (dbErr) throw new Error(`db: ${dbErr.message}`)
        // L'ancien objet ne disparaît QU'APRÈS l'update DB réussi.
        if (newName !== obj.name) {
          await supabase.storage.from(job.bucket).remove([obj.name])
        }
        processed++
        savedBytes += obj.size - optimized.byteLength
        if (processed % 25 === 0)
          console.log(`  … ${processed} traités (${(savedBytes / 1e6).toFixed(0)} Mo gagnés)`)
      } catch (e) {
        failures++
        console.error(`  ✗ ${obj.name}: ${String(e)}`)
      }
    }

    console.log(
      `${job.bucket}: ${oversized.length} surdimensionnés — ${processed} ${APPLY ? 'traités' : 'à traiter (dry-run)'}, ${orphans} orphelins ignorés, ${failures} échecs${APPLY ? `, ${(savedBytes / 1e6).toFixed(0)} Mo gagnés` : ''}`,
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
