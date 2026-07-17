/**
 * Découverte des chaînes hébergeant les MVs d'un groupe — wrapper CLI de la
 * lib partagée src/lib/scrapers/channel-discovery.ts (Phase 3 Lot 3 : la même
 * logique tourne en cron hebdo /api/cron/discover-channels ; ce script sert
 * aux passes manuelles ciblées, il AFFICHE sans seeder).
 *
 *   npx tsx scripts/discover-mv-channels.ts pentagon,ab6ix,…
 *   npx tsx scripts/discover-mv-channels.ts --thin --limit=20
 *
 * `--thin` (balayage classe « MVs manquants », 2026-07-17 — cas YENA/Stone
 * Music) : cible automatiquement les groupes à ≤ 1 MV visible. ~205 unités de
 * quota par groupe → --limit=20 ≈ 4 100 unités (quota jour 10 000, scrape
 * quotidien ~500). Sortie = candidats à REVIEW humaine ; les chaînes validées
 * vont dans youtube-channels.json puis seed + backfill (jamais d'auto-seed).
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { discoverChannelsForGroup } from '../src/lib/scrapers/channel-discovery'
import type { Database } from '../src/types/database'

loadEnvConfig(process.cwd())
const KEY = process.env.YOUTUBE_API_KEY!
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

/** Slugs des groupes à ≤ 1 MV visible (candidats aux MVs manquants). */
async function thinSlugs(limit: number): Promise<string[]> {
  const { data: groups } = await supabase.from('groups').select('id, slug, name').order('name')
  // Compte des MVs visibles par groupe — pagination : le select PostgREST est
  // capé à 1000 rows (leçon supabase-query-gotchas), les events mv en font +2000.
  const counts = new Map<string, number>()
  for (let from = 0; ; from += 1000) {
    const { data: rows, error } = await supabase
      .from('events')
      .select('group_id')
      .eq('type', 'mv')
      .eq('hidden', false)
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    for (const r of rows ?? []) counts.set(r.group_id, (counts.get(r.group_id) ?? 0) + 1)
    if (!rows || rows.length < 1000) break
  }
  const thin = (groups ?? []).filter((g) => (counts.get(g.id) ?? 0) <= 1)
  console.log(`${thin.length} groupe(s) à ≤ 1 MV visible ; balayage des ${limit} premiers.`)
  return thin.slice(0, limit).map((g) => g.slug)
}

async function main() {
  const thin = process.argv.includes('--thin')
  const limitArg = process.argv.find((a) => a.startsWith('--limit='))
  const limit = limitArg ? Number(limitArg.slice('--limit='.length)) : 20
  const slugs = thin ? await thinSlugs(limit) : (process.argv[2] ?? '').split(',').filter(Boolean)
  if (slugs.length === 0)
    throw new Error('usage: discover-mv-channels.ts slug1,slug2 | --thin --limit=N')
  const { data: groups } = await supabase.from('groups').select('slug, name').in('slug', slugs)

  let totalUnits = 0
  for (const g of groups ?? []) {
    const { candidates, units } = await discoverChannelsForGroup(g, KEY)
    totalUnits += units
    console.log(`\n=== ${g.slug} (${g.name}) ===`)
    for (const c of candidates) {
      console.log(
        `  ${c.hits.length} MV(s) | ${c.channelTitle} | ${c.url} | subs=${c.subs ?? '?'}` +
          `\n      ex: ${c.hits.slice(0, 2).join(' | ').slice(0, 110)}`,
      )
    }
    if (candidates.length === 0) console.log('  (aucune chaîne candidate)')
  }
  console.log(`\nquota consommé: ~${totalUnits} unités`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
