/**
 * Backfill : re-roule `detectEventType` sur tous les events `type='mv'` actuels
 * et reclasse en `'other'` ceux qui ne matchent plus 'mv' avec la nouvelle
 * DERIVATIVE_RE. Cf. SCRAPING.md §3.6 (markers hangul 비하인드/메이킹/티저/리액션/...).
 *
 *   npx tsx scripts/backfill-reclassify-mvs.ts            (dry-run)
 *   npx tsx scripts/backfill-reclassify-mvs.ts --write    (applique)
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { detectEventType } from '../src/lib/scrapers/youtube'
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
    .select('id, slug, title, description, type')
    .eq('type', 'mv')
  if (error) throw error
  if (!events || events.length === 0) {
    console.log('No type="mv" events. Nothing to do.')
    return
  }

  const demotions: { id: string; slug: string | null; title: string; newType: string }[] = []
  for (const ev of events) {
    const newType = detectEventType(ev.title, ev.description ?? '')
    if (newType !== 'mv') {
      demotions.push({ id: ev.id, slug: ev.slug, title: ev.title, newType })
    }
  }

  console.log(`Audited ${events.length} rows, ${demotions.length} need demotion.`)
  for (const d of demotions) {
    console.log(`  [${d.id.slice(0, 8)}] mv → ${d.newType}  :  ${d.title}`)
  }

  if (!WRITE) {
    console.log('\nDry-run. Pass --write to apply.')
    return
  }

  let ok = 0
  for (const d of demotions) {
    const { error: upErr } = await supabase
      .from('events')
      .update({ type: d.newType as Database['public']['Enums']['event_type'] })
      .eq('id', d.id)
    if (upErr) console.error(`  FAIL ${d.id}: ${upErr.message}`)
    else ok++
  }
  console.log(`\nUpdated ${ok}/${demotions.length} events.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
