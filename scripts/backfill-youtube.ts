// Backfill one-shot des MV YouTube pour des sources fraîchement seedées (P0.5).
// Paginera l'historique de la playlist uploads (1 unit / 50 vidéos — cf.
// SCRAPING.md §2) avec les mêmes gates que le cron quotidien.
//
// Usage :
//   npx tsx scripts/backfill-youtube.ts --new            # sources jamais scrapées
//   npx tsx scripts/backfill-youtube.ts --slugs=bts,twice # groupes ciblés
//   npx tsx scripts/backfill-youtube.ts --new --max-pages=12
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database'
import { scrapeGroup, QuotaExceededError } from '../src/lib/scrapers/youtube'

function envLocal(key: string): string {
  const line = readFileSync('.env.local', 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`${key}=`))
  if (!line) throw new Error(`${key} absent de .env.local`)
  return line
    .slice(key.length + 1)
    .replace(/^"|"$/g, '')
    .trim()
}

function arg(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : null
}

async function main() {
  const supabase = createClient<Database>(
    envLocal('NEXT_PUBLIC_SUPABASE_URL'),
    envLocal('SUPABASE_SERVICE_ROLE_KEY'),
  )
  const apiKey = envLocal('YOUTUBE_API_KEY')
  const maxPages = Number(arg('max-pages') ?? '12')
  const onlyNew = process.argv.includes('--new')
  const slugs = arg('slugs')?.split(',') ?? null

  let query = supabase
    .from('sources')
    .select('id, name, url, group_id, last_scraped_at, groups(slug)')
    .eq('type', 'youtube_api')
    .not('group_id', 'is', null)
  if (onlyNew) query = query.is('last_scraped_at', null)
  const { data: sources, error } = await query
  if (error) throw error

  const targets = (sources ?? []).filter(
    (s) => !slugs || (s.groups && slugs.includes(s.groups.slug)),
  )
  console.log(`${targets.length} source(s) à backfiller (maxPages=${maxPages})\n`)

  let totalUnits = 0
  let totalInserted = 0
  for (const s of targets) {
    try {
      const r = await scrapeGroup(
        { id: s.id, url: s.url, group_id: s.group_id! },
        apiKey,
        supabase,
        { maxPages },
      )
      totalUnits += r.units
      totalInserted += r.inserted
      console.log(
        `✔ ${s.name} — inserted=${r.inserted} skipped=${r.skipped} premieres=${r.premieres} units=${r.units}`,
      )
    } catch (e) {
      if (e instanceof QuotaExceededError) {
        console.error(`✖ QUOTA ÉPUISÉ sur ${s.name} — arrêt (reprendre demain avec --new).`)
        break
      }
      console.error(`✖ ${s.name} — ${String(e)}`)
    }
  }
  console.log(`\nTotal : ${totalInserted} MV insérés, ${totalUnits} units consommées.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
