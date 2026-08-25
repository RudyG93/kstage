// Promotion d'UN membre de groupe en soliste : sa propre fiche `/artists/<slug>`.
//
// La logique et ses gardes vivent dans `src/lib/roster/promote-soloist.ts` —
// partagées avec le script de lot, pour qu'elles ne puissent pas diverger.
// Ici : les arguments, l'affichage, et rien d'autre.
//
//   npx tsx scripts/roster/promote-member-to-soloist.ts --member=idle-miyeon
//   npx tsx scripts/roster/promote-member-to-soloist.ts --member=idle-miyeon --apply
//   npx tsx scripts/roster/promote-member-to-soloist.ts --member=idle-miyeon \
//     --artist-slug=miyeon --apply
//
// Idempotent : relancé sur une personne déjà promue, il refuse sans rien
// écrire. Dry-run par défaut.
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

async function main() {
  const memberSlug = arg('member')
  if (!memberSlug) {
    console.error('REFUS — --member=<slug de la row members> est requis')
    process.exit(1)
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const fichesSolo = await chargerFichesSolo(supabase)
  const v = await evaluer(supabase, memberSlug, fichesSolo, arg('artist-slug'))
  if (!v.ok) {
    console.error(`REFUS — ${v.raison}`)
    process.exit(1)
  }

  console.log(`Personne  : ${v.source.stage_name} (${v.source.groupe.name})`)
  console.log(`  real_name ${v.source.real_name ?? '—'} · birthday ${v.source.birthday ?? '—'}`)
  console.log(`Fiche solo : /artists/${v.artistSlug}`)
  if (v.nomCourt)
    console.log(
      `  ! nom court (« ${v.artistSlug} ») — aucune chaîne YouTube ne sera seedée automatiquement`,
    )
  console.log(
    `\n${v.events.length} event(s) du groupe nomment ${v.source.stage_name} en mot entier :${v.events.length ? '' : ' aucun'}`,
  )
  for (const e of v.events) console.log(`  ${e.start_at.slice(0, 10)}  [${e.type}]  ${e.title}`)

  if (!APPLY) {
    console.log('\n(dry-run — relancer avec --apply pour écrire)')
    return
  }

  const r = await promouvoir(supabase, v)
  console.log(
    `\nCréé : /artists/${r.artistSlug} · ${r.liens} lien(s) MusicBrainz · ${r.eventsDeplaces}/${v.events.length} event(s) déplacé(s) · artist_slug = ${r.artistSlugPose ?? 'NON POSÉ (trigger muet)'}`,
  )
  if (r.artistSlugPose !== r.artistSlug)
    console.error('  ! artist_slug absent — la page /artists ne résoudra pas')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
