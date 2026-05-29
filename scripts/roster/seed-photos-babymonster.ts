/**
 * Backfill manuel pour BABYMONSTER (post-freeze kpopnet, debut 2023-11-27) :
 *   - Rename `babymonster-haram` → `babymonster-rami` si présent (Haram a quitté
 *     pré-debut, le 7ᵉ membre actuel est Rami). Le bug data vient du scrape
 *     dbkpop opportuniste (`scripts/roster/seed-members.ts`) qui contenait
 *     encore l'ancien roster pré-debut.
 *   - Apply 7 photos officielles depuis YG Family CDN
 *     (`ygfamily.com/contents/images/2026/05/<NAME>_1.jpg`, sauf Rami 2024/11).
 *
 * Idempotent : skip ce qui est déjà à jour. Safe upsert : n'écrase jamais une
 * photo déjà présente.
 *
 *   npx tsx scripts/roster/seed-photos-babymonster.ts            (dry-run)
 *   npx tsx scripts/roster/seed-photos-babymonster.ts --write    (applique)
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../src/types/database'

loadEnvConfig(process.cwd())
const WRITE = process.argv.includes('--write')

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const PHOTOS: Record<string, string> = {
  'babymonster-ruka': 'https://www.ygfamily.com/contents/images/2026/05/RUKA_1.jpg',
  'babymonster-pharita': 'https://www.ygfamily.com/contents/images/2026/05/PHARITA_1.jpg',
  'babymonster-asa': 'https://www.ygfamily.com/contents/images/2026/05/ASA_1.jpg',
  'babymonster-ahyeon': 'https://www.ygfamily.com/contents/images/2026/05/AHYEON_1.jpg',
  'babymonster-rami': 'https://www.ygfamily.com/contents/images/2024/11/rami_1.jpg',
  'babymonster-rora': 'https://www.ygfamily.com/contents/images/2026/05/RORA_1.jpg',
  'babymonster-chiquita': 'https://www.ygfamily.com/contents/images/2026/05/CHIQUITA_1.jpg',
}

async function main() {
  console.log(`\n=== ${WRITE ? 'WRITE' : 'DRY-RUN'} ===\n`)

  // 1) Rename `babymonster-haram` → `babymonster-rami` si existe.
  const { data: haram } = await supabase
    .from('members')
    .select('id, slug, stage_name')
    .eq('slug', 'babymonster-haram')
    .maybeSingle()

  let renamed = false
  if (haram) {
    console.log(`Haram → Rami : found ${haram.slug} (${haram.stage_name})`)
    if (WRITE) {
      const { error } = await supabase
        .from('members')
        .update({
          stage_name: 'Rami',
          slug: 'babymonster-rami',
          // YG Family ne expose pas le real_name de Rami → null explicitement
          // pour ne pas garder "Shin Haram" qui était attaché à l'ancienne row.
          real_name: null,
        })
        .eq('id', haram.id)
      if (error) {
        console.error(`  FAIL rename: ${error.message}`)
        process.exit(1)
      }
      renamed = true
      console.log('  RENAMED.')
    } else {
      console.log('  (dry-run, skipping)')
    }
  } else {
    console.log('Haram → Rami : already renamed or never existed. Skipping.')
  }

  // 2) Apply photos.
  const { data: members } = await supabase
    .from('members')
    .select('id, slug, photo_url')
    .in('slug', Object.keys(PHOTOS))
  if (!members) throw new Error('Failed to fetch members')

  let toUpdate = 0
  let skipped = 0
  const work: { id: string; slug: string; url: string }[] = []
  for (const slug of Object.keys(PHOTOS)) {
    const m = members.find((x) => x.slug === slug)
    if (!m) {
      console.log(`  ⚠ member ${slug} not found in DB (skip)`)
      continue
    }
    if (m.photo_url) {
      console.log(`  ${slug.padEnd(24)} already has photo (skip)`)
      skipped++
      continue
    }
    console.log(`  ${slug.padEnd(24)} → ${PHOTOS[slug]}`)
    work.push({ id: m.id, slug, url: PHOTOS[slug] })
    toUpdate++
  }

  console.log(
    `\n${toUpdate} photo(s) to apply, ${skipped} already up-to-date, rename: ${renamed ? 'applied' : 'unchanged or dry-run'}.`,
  )

  if (!WRITE) {
    console.log('\nDry-run. Pass --write to apply.')
    return
  }

  let ok = 0
  for (const w of work) {
    const { error } = await supabase.from('members').update({ photo_url: w.url }).eq('id', w.id)
    if (error) console.error(`  FAIL ${w.slug}: ${error.message}`)
    else ok++
  }
  console.log(`\nDone. Photos applied: ${ok}/${work.length}.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
