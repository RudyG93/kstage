// Promotion EN LOT des membres détectés comme solistes.
//
// Le détecteur (`detect-soloist-members.ts`) sort la liste ; ce script la passe
// une par une par les mêmes gardes que la promotion unitaire — elles vivent
// toutes dans `src/lib/roster/promote-soloist.ts`, jamais dupliquées.
//
//   npx tsx scripts/roster/detect-soloist-members.ts --json > solo-detect.json
//   npx tsx scripts/roster/promote-soloists-batch.ts --in=solo-detect.json
//   npx tsx scripts/roster/promote-soloists-batch.ts --in=solo-detect.json --apply --limit=20
//
// POURQUOI UN PLAFOND. La promotion elle-même ne coûte qu'un lookup MusicBrainz
// (throttlé 1 req/s), mais une fiche sans MV est exactement la « fiche bâclée »
// qu'on refuse. L'enrichissement média coûte ~213 units YouTube par artiste :
// 103 d'un coup, c'est 22 000 units contre un quota de 10 000/jour. On promeut
// donc par vagues, et chaque vague est enrichie avant la suivante.
//
// Les events du groupe dont le titre nomme le membre en mot entier suivent la
// personne : beaucoup de fiches naissent donc déjà peuplées, sans un seul
// appel YouTube.
//
// Dry-run par défaut. Idempotent : une personne déjà promue est refusée.
import { readFileSync } from 'node:fs'
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { chargerFichesSolo, evaluer, promouvoir } from '../../src/lib/roster/promote-soloist'
import type { Database } from '../../src/types/database'

loadEnvConfig(process.cwd())

const APPLY = process.argv.includes('--apply')
const arg = (nom: string) =>
  process.argv
    .find((a) => a.startsWith(`--${nom}=`))
    ?.split('=')
    .slice(1)
    .join('=') ?? null

const FICHIER = arg('in') ?? 'solo-detect.json'
const LIMITE = Number(arg('limit') ?? 0)
/** MusicBrainz impose 1 req/s ; `fetchMbEnrichment` en fait 1 à 2 par artiste. */
const PAUSE_MS = 1200

interface Candidat {
  slug: string
  membre: string
  groupe: string
  soloDebut: string
}

async function main() {
  const candidats = JSON.parse(readFileSync(FICHIER, 'utf8')) as Candidat[]
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Chargée UNE fois puis tenue à jour à chaque création : la relire par
  // candidat coûterait 103 requêtes pour une donnée qu'on connaît déjà.
  const fichesSolo = await chargerFichesSolo(supabase)

  const retenus: { c: Candidat; v: Extract<Awaited<ReturnType<typeof evaluer>>, { ok: true }> }[] =
    []
  const refuses: { slug: string; raison: string }[] = []

  console.log(`${candidats.length} candidats — évaluation à blanc\n`)
  for (const c of candidats) {
    const v = await evaluer(supabase, c.slug, fichesSolo)
    if (!v.ok) refuses.push({ slug: c.slug, raison: v.raison })
    else retenus.push({ c, v })
  }

  // Les fiches qui naissent peuplées d'abord : elles sont immédiatement utiles,
  // et elles n'ont besoin d'aucun appel YouTube pour ne pas être vides.
  retenus.sort((a, b) => b.v.events.length - a.v.events.length)

  console.log(`${retenus.length} promouvables, ${refuses.length} refusés\n`)
  const avecEvents = retenus.filter((r) => r.v.events.length > 0).length
  console.log(
    `  ${avecEvents} naîtraient avec au moins un event repris du groupe, ${retenus.length - avecEvents} vides jusqu'à enrichissement`,
  )
  const courts = retenus.filter((r) => r.v.nomCourt).map((r) => r.v.artistSlug)
  if (courts.length)
    console.log(`  ${courts.length} nom(s) trop court(s) pour un seed auto : ${courts.join(', ')}`)

  if (refuses.length) {
    console.log('\nRefusés :')
    for (const r of refuses) console.log(`  ${r.slug.padEnd(28)} ${r.raison}`)
  }

  const lot = LIMITE > 0 ? retenus.slice(0, LIMITE) : retenus
  console.log(`\n${lot.length} à traiter${LIMITE ? ` (--limit=${LIMITE})` : ''} :`)
  for (const { c, v } of lot)
    console.log(
      `  ${v.artistSlug.padEnd(24)} ← ${c.slug.padEnd(26)} ${String(v.events.length).padStart(2)} event(s)`,
    )

  if (!APPLY) {
    console.log('\n(dry-run — relancer avec --apply pour écrire)')
    return
  }

  let crees = 0
  let eventsDeplaces = 0
  for (const { v } of lot) {
    try {
      const r = await promouvoir(supabase, v)
      crees++
      eventsDeplaces += r.eventsDeplaces
      console.log(
        `  ✓ /artists/${r.artistSlug} · ${r.liens} lien(s) · ${r.eventsDeplaces} event(s)${r.artistSlugPose === r.artistSlug ? '' : '  ! artist_slug NON POSÉ'}`,
      )
      // La nouvelle fiche entre dans l'index : la personne suivante qui serait
      // la même (deux rows dans deux groupes) sera refusée, comme il se doit.
      fichesSolo.push({
        id: 'nouveau',
        stage_name: v.source.stage_name,
        real_name: v.source.real_name,
        birthday: v.source.birthday,
        canonical_id: null,
        group_id: 'nouveau',
      })
    } catch (e) {
      console.error(`  ✗ ${v.artistSlug}: ${String(e)}`)
    }
    await new Promise((r) => setTimeout(r, PAUSE_MS))
  }

  console.log(`\n${crees}/${lot.length} fiches créées · ${eventsDeplaces} event(s) déplacé(s)`)
  console.log(
    `\nEnrichissement média (~213 units YouTube chacun, quota 10 000/jour) :\n  npx tsx scripts/roster/enrich-group-media.ts --group=<slug> --apply`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
