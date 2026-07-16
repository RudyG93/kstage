/**
 * Découverte des chaînes hébergeant les MVs d'un groupe — wrapper CLI de la
 * lib partagée src/lib/scrapers/channel-discovery.ts (Phase 3 Lot 3 : la même
 * logique tourne en cron hebdo /api/cron/discover-channels ; ce script sert
 * aux passes manuelles ciblées, il AFFICHE sans seeder).
 *
 *   npx tsx scripts/discover-mv-channels.ts pentagon,ab6ix,…
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

async function main() {
  const slugs = (process.argv[2] ?? '').split(',').filter(Boolean)
  if (slugs.length === 0) throw new Error('usage: discover-mv-channels.ts slug1,slug2')
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
