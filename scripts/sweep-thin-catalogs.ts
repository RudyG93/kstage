// Sweep one-shot des catalogues MV maigres (round 2026-07-18) : 41 groupes
// actifs à ≤1 MV (78 à ≤5, UNIS à 4) — le cron hebdo (10/lundi) mettrait des
// semaines. Même logique/gates que /api/cron/discover-channels :
// discoverChannelsForGroup (200 units) → seedAndBackfillChannel (≥2 MVs
// title-matchés, jamais d'auto-seed ambigu). Bonus : si la meilleure chaîne
// est DÉJÀ seedée, re-scan profond de la source existante (uploads tronqués —
// cas UNIS).
//
//   npx tsx scripts/sweep-thin-catalogs.ts --budget=6000 [--dry]
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database'
import {
  discoverChannelsForGroup,
  seedAndBackfillChannel,
} from '../src/lib/scrapers/channel-discovery'
import { scrapeGroup } from '../src/lib/scrapers/youtube'

loadEnvConfig(process.cwd())

const DRY = process.argv.includes('--dry')
const BUDGET = Number(process.argv.find((a) => a.startsWith('--budget='))?.slice(9) ?? '6000')
const THIN = 5

async function main() {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) throw new Error('YOUTUBE_API_KEY manquant')

  const { data: groups } = await supabase
    .from('groups')
    .select('id, name, slug, confidence, debut_date, disbanded_on')
    .is('disbanded_on', null)
  const mvCount = new Map<string, number>()
  for (let from = 0; ; from += 1000) {
    const { data: rows } = await supabase
      .from('events')
      .select('group_id')
      .eq('type', 'mv')
      .eq('hidden', false)
      .range(from, from + 999)
    for (const r of rows ?? []) {
      if (r.group_id) mvCount.set(r.group_id, (mvCount.get(r.group_id) ?? 0) + 1)
    }
    if (!rows || rows.length < 1000) break
  }
  const pool = (groups ?? [])
    .map((g) => ({ g, n: mvCount.get(g.id) ?? 0 }))
    .filter(({ n }) => n <= THIN)
    .sort((a, b) => a.n - b.n)
  console.log(`Pool: ${pool.length} groupes ≤${THIN} MVs · budget ${BUDGET} units`)
  if (DRY) {
    for (const { g, n } of pool) console.log(`  ${g.name} (${g.slug}) — ${n} MV`)
    return
  }

  let units = 0
  let seeded = 0
  let deepened = 0
  const review: string[] = []
  for (const { g, n } of pool) {
    if (units + 210 > BUDGET) {
      console.log(`Budget atteint (${units}) — ${pool.length - seeded - deepened} restants.`)
      break
    }
    try {
      const disc = await discoverChannelsForGroup(g, apiKey)
      units += disc.units
      const best = [...disc.candidates].sort((a, b) => b.hits.length - a.hits.length)[0]
      if (!best) {
        review.push(`${g.slug} (${n} MV) — aucune chaîne candidate`)
        continue
      }
      const res = await seedAndBackfillChannel(supabase, g, best, apiKey)
      if (res.seeded) {
        units += res.units
        seeded++
        console.log(`✓ ${g.slug}: seed ${best.channelTitle} — +${res.backfilled} MVs`)
      } else if (res.reason === 'source déjà présente') {
        // Chaîne connue mais catalogue toujours fin → uploads tronqués : deep.
        const { data: src } = await supabase
          .from('sources')
          .select('id, url, group_id')
          .eq('group_id', g.id)
          .eq('url', best.url)
          .single()
        if (src?.group_id) {
          const deep = await scrapeGroup(
            { id: src.id, url: src.url, group_id: src.group_id },
            apiKey,
            supabase,
            { maxPages: 40 },
          )
          units += deep.units
          deepened++
          console.log(`↻ ${g.slug}: deep re-scan — +${deep.inserted} MVs`)
        }
      } else {
        review.push(`${g.slug} (${n} MV) — ${res.reason}`)
      }
    } catch (e) {
      review.push(`${g.slug}: ${String(e)}`)
      if (String(e).includes('quota')) break
    }
  }
  console.log(`\n${seeded} seedés, ${deepened} deep re-scans, ${units} units.`)
  if (review.length > 0) {
    console.log(`À revoir (${review.length}):`)
    for (const r of review) console.log(`  ${r}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
