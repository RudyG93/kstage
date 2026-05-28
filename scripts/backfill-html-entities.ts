/**
 * Backfill : décode les entités HTML (`&#39;`, `&amp;`, etc.) dans
 * `events.title` et `events.description` pour les rows ingérées depuis YouTube
 * avant le fix de scrapers/youtube.ts. Régénère aussi les slugs des rows
 * concernées (un slug qui contient "39" provient d'une apostrophe non décodée).
 *
 *   npx tsx scripts/backfill-html-entities.ts            (dry-run)
 *   npx tsx scripts/backfill-html-entities.ts --write    (applique)
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { buildEventSlug } from '../src/lib/events/slug'
import { decodeHtmlEntities } from '../src/lib/scrapers/html-entities'
import type { Database } from '../src/types/database'

loadEnvConfig(process.cwd())
const WRITE = process.argv.includes('--write')

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function hasEntities(s: string | null | undefined): boolean {
  if (!s) return false
  return /&(#\d+|#x[0-9a-f]+|amp|lt|gt|quot|apos|nbsp);/i.test(s)
}

async function main() {
  const { data: events, error } = await supabase
    .from('events')
    .select('id, title, description, slug, group_id, groups!inner(slug, name)')
  if (error) throw error
  if (!events) return

  // Filtre les rows qui ont au moins une entité dans title OU description.
  const affected = events.filter((e) => hasEntities(e.title) || hasEntities(e.description))
  if (affected.length === 0) {
    console.log('No events with HTML entities. Nothing to do.')
    return
  }

  // Réserve les slugs existants (hors ceux qu'on s'apprête à changer) pour
  // pouvoir gérer les collisions au moment où on régénère un slug.
  const affectedIds = new Set(affected.map((e) => e.id))
  const taken = new Set<string>(
    events.filter((e) => e.slug && !affectedIds.has(e.id)).map((e) => e.slug as string),
  )

  const updates: {
    id: string
    title: { from: string; to: string } | null
    description: { from: string; to: string } | null
    slug: { from: string | null; to: string } | null
  }[] = []

  for (const ev of affected) {
    const group = ev.groups as { slug: string; name: string } | null
    const cleanTitle = decodeHtmlEntities(ev.title)
    const cleanDescription = ev.description ? decodeHtmlEntities(ev.description) : null

    const titleChange = cleanTitle !== ev.title ? { from: ev.title, to: cleanTitle } : null
    const descChange =
      cleanDescription !== ev.description
        ? { from: ev.description ?? '', to: cleanDescription ?? '' }
        : null

    // Régénération du slug uniquement si le titre a changé (sinon le slug
    // courant reste valide) ET si on a bien un group slug.
    let slugChange: { from: string | null; to: string } | null = null
    if (titleChange && group?.slug) {
      const base = buildEventSlug(group.slug, cleanTitle, group.name)
      let candidate = base || `event-${ev.id.slice(0, 8)}`
      let i = 2
      while (taken.has(candidate)) {
        candidate = `${base}-${i++}`
      }
      taken.add(candidate)
      if (candidate !== ev.slug) {
        slugChange = { from: ev.slug, to: candidate }
      }
    }

    updates.push({
      id: ev.id,
      title: titleChange,
      description: descChange,
      slug: slugChange,
    })
  }

  console.log(`Backfill plan : ${updates.length} events`)
  for (const u of updates) {
    if (u.title) console.log(`  [${u.id.slice(0, 8)}] title  : ${u.title.to}`)
    if (u.slug) console.log(`  [${u.id.slice(0, 8)}] slug   : ${u.slug.from} → ${u.slug.to}`)
  }

  if (!WRITE) {
    console.log('\nDry-run. Pass --write to apply.')
    return
  }

  let ok = 0
  for (const u of updates) {
    // Spread conditionnel : TS infère le type depuis le littéral et matche
    // exactement `events.Update` (vs `Record<string, ...>` qui est trop large
    // pour le check strict de Next.js / Vercel).
    const patch = {
      ...(u.title && { title: u.title.to }),
      ...(u.description && { description: u.description.to || null }),
      ...(u.slug && { slug: u.slug.to }),
    }
    if (Object.keys(patch).length === 0) continue

    const { error: upErr } = await supabase.from('events').update(patch).eq('id', u.id)
    if (upErr) console.error(`  FAIL ${u.id}: ${upErr.message}`)
    else ok++
  }
  console.log(`\nUpdated ${ok}/${updates.length} events.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
