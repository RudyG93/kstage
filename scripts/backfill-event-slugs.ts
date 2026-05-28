/**
 * Backfill des `events.slug` pour les rows existantes.
 *
 * Génère `${group.slug}-${slugify(title)}` ; collision → suffixe `-2`, `-3`, …
 * Idempotent : skip si `slug is not null`. Lancer en dry-run d'abord, puis --write.
 *
 *   npx tsx scripts/backfill-event-slugs.ts            (dry-run)
 *   npx tsx scripts/backfill-event-slugs.ts --write    (applique)
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { buildEventSlug } from '../src/lib/events/slug'
import type { Database } from '../src/types/database'

loadEnvConfig(process.cwd())
const WRITE = process.argv.includes('--write')

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function main() {
  const { data: events, error } = await supabase
    .from('events')
    .select('id, title, slug, group_id, groups!inner(slug)')
    .is('slug', null)
  if (error) throw error
  if (!events || events.length === 0) {
    console.log('No events without slug. Nothing to do.')
    return
  }

  // Réserve les slugs déjà pris (incluant les éventuels du run en cours).
  const { data: existingRows } = await supabase
    .from('events')
    .select('slug')
    .not('slug', 'is', null)
  const taken = new Set<string>(
    (existingRows ?? []).map((r) => r.slug).filter((s): s is string => Boolean(s)),
  )

  const updates: { id: string; title: string; slug: string }[] = []
  for (const ev of events) {
    const groupSlug = (ev.groups as { slug: string } | null)?.slug
    if (!groupSlug) {
      console.warn(`Skip ${ev.id}: no group slug`)
      continue
    }
    const base = buildEventSlug(groupSlug, ev.title)
    let candidate = base || `event-${ev.id.slice(0, 8)}`
    let i = 2
    while (taken.has(candidate)) {
      candidate = `${base}-${i++}`
    }
    taken.add(candidate)
    updates.push({ id: ev.id, title: ev.title, slug: candidate })
  }

  console.log(`Backfill plan : ${updates.length} events`)
  for (const u of updates) {
    console.log(`  ${u.slug.padEnd(50)} ← ${u.title}`)
  }

  if (!WRITE) {
    console.log('\nDry-run. Pass --write to apply.')
    return
  }

  for (const u of updates) {
    const { error: upErr } = await supabase.from('events').update({ slug: u.slug }).eq('id', u.id)
    if (upErr) console.error(`  FAIL ${u.id}: ${upErr.message}`)
  }
  console.log(`\nUpdated ${updates.length} events.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
