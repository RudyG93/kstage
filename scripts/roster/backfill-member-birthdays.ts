// Dates de naissance manquantes, récupérées sur fandom.
//
// L'enrichissement des dates passe par MusicBrainz (`ingest.ts`), qui
// référence mal les groupes récents : 623 membres sur 1 290 n'avaient aucune
// date au 2026-08-24, sur 137 groupes. Or c'est la date qui produit l'event
// anniversaire — sans elle, le membre est absent du calendrier, du bloc
// « Birthdays » et du digest.
//
// Mesuré sur un échantillon de 20 : 19 récupérés (le raté est un groupe
// VIRTUEL, qui n'a pas de date à trouver).
//
//   npx tsx scripts/roster/backfill-member-birthdays.ts              (revue)
//   npx tsx scripts/roster/backfill-member-birthdays.ts --apply      (écrit)
//   npx tsx scripts/roster/backfill-member-birthdays.ts --apply --limit=50
//
// Idempotent : ne touche QUE les membres sans date, et n'écrase jamais.
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { fetchMemberBirthday } from '../../src/lib/scrapers/debuts/fandom-birthdays'
import type { Database } from '../../src/types/database'

loadEnvConfig(process.cwd())

const APPLY = process.argv.includes('--apply')
const LIMITE = Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? 0)
/** Poli avec une API gratuite : ~5 requêtes/s au pire. */
const PAUSE_MS = 200

async function main() {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const membres: { id: string; nom: string; groupe: string }[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('members')
      .select('id, stage_name, groups!inner(name)')
      .is('canonical_id', null)
      .is('birthday', null)
      .order('id')
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    if (!data?.length) break
    for (const m of data)
      membres.push({
        id: m.id,
        nom: m.stage_name,
        groupe: (m.groups as unknown as { name: string }).name,
      })
    if (data.length < 1000) break
  }

  const cible = LIMITE > 0 ? membres.slice(0, LIMITE) : membres
  console.log(
    `${membres.length} membres sans date${LIMITE ? ` — on en traite ${cible.length}` : ''}`,
  )

  let trouves = 0
  let ecrits = 0
  const introuvables: string[] = []
  for (const [i, m] of cible.entries()) {
    const b = await fetchMemberBirthday(m.nom, m.groupe).catch(() => null)
    if (b) {
      trouves++
      if (APPLY) {
        const { error } = await supabase
          .from('members')
          .update({ birthday: b })
          .eq('id', m.id)
          .is('birthday', null) // jamais d'écrasement, même en cas de course
        if (error) console.error(`   ! ${m.groupe}/${m.nom} : ${error.message}`)
        else ecrits++
      }
    } else if (introuvables.length < 30) {
      introuvables.push(`${m.groupe} / ${m.nom}`)
    }
    if ((i + 1) % 25 === 0) console.log(`   ${i + 1}/${cible.length} — ${trouves} trouvés`)
    await new Promise((r) => setTimeout(r, PAUSE_MS))
  }

  console.log(`\n${trouves}/${cible.length} dates trouvées${APPLY ? `, ${ecrits} écrites` : ''}`)
  if (introuvables.length > 0) {
    console.log(`\nSans date sur fandom (${introuvables.length} premiers) :`)
    for (const x of introuvables) console.log(`   ${x}`)
  }
  if (!APPLY) console.log('\n(revue seule — relancer avec --apply pour écrire)')
}

main()
