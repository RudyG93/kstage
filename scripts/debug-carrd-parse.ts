// Débogage one-shot : rejoue le parseur carrd + le matching canonique sur un
// markdown local (scratchpad) pour localiser une perte de lineup.
//   npx tsx scripts/debug-carrd-parse.ts <chemin-markdown>
import { readFileSync } from 'node:fs'
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { parseLineups } from '../src/lib/scrapers/music-shows/sources/live-show-updates'
import { extractCanonicalName } from '../src/lib/scrapers/music-shows/canonical'
import { normalize } from '../src/lib/scrapers/group-match'
import type { Database } from '../src/types/database'

loadEnvConfig(process.cwd())

// Réplique de matchGroup du cron scrape-music-shows (normalize + alias).
const GROUP_ALIASES: Record<string, string> = { gidle: 'idle' }

async function main() {
  const md = readFileSync(process.argv[2]!, 'utf8')
  const lineups = parseLineups(md)
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data: groups } = await supabase.from('groups').select('id, name, slug')

  function matchGroup(artistName: string) {
    const key = normalize(artistName)
    if (!key) return null
    for (const g of groups ?? []) {
      if (normalize(g.name) === key || normalize(g.slug) === key) return g
    }
    const aliasSlug = GROUP_ALIASES[key]
    if (aliasSlug) return (groups ?? []).find((g) => g.slug === aliasSlug) ?? null
    return null
  }

  for (const l of lineups) {
    console.log(`\n=== ${l.show} EP.${l.episodeNumber} ${l.monthDay} ${l.time12h} ===`)
    for (const raw of l.artistsRaw) {
      const canonical = extractCanonicalName(raw)
      const hit = canonical ? matchGroup(canonical) : null
      console.log(
        `  ${hit ? 'MATCH  ' : 'unmatch'} raw="${raw}" canonical="${canonical}"${hit ? ` → ${hit.slug}` : ''}`,
      )
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
