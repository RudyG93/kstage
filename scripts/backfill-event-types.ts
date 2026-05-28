/**
 * Backfill du type d'event pour les rows existantes.
 *
 * Pourquoi : la régex `detectEventType` a été enrichie (ajout de `\balbum\b`
 * pour mieux classer en `release`), mais les events scrapés avant ce changement
 * gardent leur ancien type (idempotence sur source_url). Ce script ré-évalue
 * `detectEventType(title, '')` sur chaque event et UPDATE si le type change.
 *
 * Lancer (manuel, env vars chargés depuis .env.local par @next/env) :
 *   npx tsx scripts/backfill-event-types.ts            (dry-run, log uniquement)
 *   npx tsx scripts/backfill-event-types.ts --write    (applique réellement)
 *
 * Sécurité : service_role, server-only. Idempotent.
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { detectEventType } from '../src/lib/scrapers/youtube'
import type { Database } from '../src/types/database'

type EventType = Database['public']['Enums']['event_type']

loadEnvConfig(process.cwd())
const WRITE = process.argv.includes('--write')

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function main() {
  const { data: events, error } = await supabase
    .from('events')
    .select('id, title, type')
    .order('start_at', { ascending: false })
  if (error) throw error
  if (!events) {
    console.log('No events found.')
    return
  }

  const changes: { id: string; title: string; from: EventType; to: EventType }[] = []
  for (const ev of events) {
    const next = detectEventType(ev.title, '')
    if (next !== ev.type) {
      changes.push({ id: ev.id, title: ev.title, from: ev.type, to: next })
    }
  }

  console.log(`Scanned ${events.length} events → ${changes.length} need re-classification.`)
  for (const c of changes) {
    console.log(`  ${c.from} → ${c.to}  |  ${c.title}`)
  }

  if (!WRITE) {
    console.log('\nDry-run. Pass --write to apply.')
    return
  }
  if (changes.length === 0) return

  for (const c of changes) {
    const { error: upErr } = await supabase.from('events').update({ type: c.to }).eq('id', c.id)
    if (upErr) {
      console.error(`  FAIL ${c.id}: ${upErr.message}`)
    }
  }
  console.log(`\nUpdated ${changes.length} events.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
