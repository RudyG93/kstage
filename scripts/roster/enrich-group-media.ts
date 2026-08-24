// Enrichissement média d'un groupe/soliste DÉJÀ en base : découverte de chaîne
// YouTube si besoin, puis backfill des MV.
//
// `enrichNewGroupMedia` n'était appelable que depuis les actions admin, sur un
// artiste fraîchement créé. Une fiche promue à la main (ou créée avant que
// l'enrichissement n'existe) restait donc vide jusqu'au cron du lundi. C'est
// exactement la « fiche bâclée » qu'on refuse : une page d'artiste sans un seul
// MV n'informe personne.
//
//   npx tsx scripts/roster/enrich-group-media.ts --group=miyeon
//   npx tsx scripts/roster/enrich-group-media.ts --group=miyeon --apply
//
// Coût : ~201 units YouTube si aucune source n'existe (2 × search.list), ~1 par
// page d'uploads sinon. Le quota journalier est de 10 000.
//
// Après le backfill, chaque MV inséré est relu et confronté au nom de
// l'artiste en MOT ENTIER : une chaîne d'agence publie les MV de tout son
// roster, et `matchesGroup` (sous-chaîne) suffit à ramener ceux des voisins.
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { enrichNewGroupMedia } from '../../src/lib/scrapers/debuts/ingest'
import { mentionsArtist } from '../../src/lib/scrapers/group-match'
import type { Database } from '../../src/types/database'

loadEnvConfig(process.cwd())

const APPLY = process.argv.includes('--apply')
const GROUP_SLUG = process.argv.find((a) => a.startsWith('--group='))?.slice(8) ?? null

async function main() {
  if (!GROUP_SLUG) {
    console.error('REFUS — --group=<slug> est requis')
    process.exit(1)
  }
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    console.error('REFUS — YOUTUBE_API_KEY absent de l’environnement')
    process.exit(1)
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: groupe, error } = await supabase
    .from('groups')
    .select('id, slug, name, is_solo, name_aliases')
    .eq('slug', GROUP_SLUG)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!groupe) {
    console.error(`REFUS — aucun groupe de slug « ${GROUP_SLUG} »`)
    process.exit(1)
  }

  const { count: avant } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', groupe.id)
    .eq('type', 'mv')
  const { data: sources } = await supabase
    .from('sources')
    .select('url')
    .eq('group_id', groupe.id)
    .eq('type', 'youtube_api')

  console.log(`${groupe.name} (${groupe.slug})${groupe.is_solo ? ' — soliste' : ''}`)
  console.log(`  ${avant ?? 0} MV en base · ${sources?.length ?? 0} source(s) YouTube`)
  if (!APPLY) {
    console.log(
      `\n(dry-run — --apply lancerait ${sources?.length ? 'un backfill des sources existantes' : 'une découverte de chaîne (~201 units)'})`,
    )
    return
  }

  const res = await enrichNewGroupMedia(supabase, groupe.id, apiKey)
  console.log(
    `\n${res.inserted} MV inséré(s) · chaîne ${res.seeded ? 'découverte et seedée' : 'non seedée'} · ${res.units} units consommées`,
  )
  for (const n of res.notes) console.log(`  note: ${n}`)

  // Relecture : un MV qui ne nomme pas l'artiste en mot entier vient d'un voisin
  // de roster sur la même chaîne d'agence.
  const { data: mvs } = await supabase
    .from('events')
    .select('id, title, start_at')
    .eq('group_id', groupe.id)
    .eq('type', 'mv')
    .order('start_at', { ascending: false })
  const aliases = (groupe.name_aliases ?? []) as string[]
  const suspects = (mvs ?? []).filter((m) => !mentionsArtist(m.title, groupe.name, aliases))
  console.log(`\n${mvs?.length ?? 0} MV au total sur la fiche :`)
  for (const m of mvs ?? [])
    console.log(
      `  ${mentionsArtist(m.title, groupe.name, aliases) ? '✓' : '✗'} ${m.start_at.slice(0, 10)}  ${m.title}`,
    )
  if (suspects.length)
    console.error(
      `\n! ${suspects.length} MV ne nomment pas « ${groupe.name} » en mot entier — à arbitrer avant de laisser la fiche en ligne`,
    )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
