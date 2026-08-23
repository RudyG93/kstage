// Rattrapage de `groups.agency` et `groups.fandom_name` depuis kpop.fandom.
//
// La couverture actuelle est À L'ENVERS : `agency` vient du scraper de debuts,
// qui ne visite que les nouveaux groupes. Mesuré le 2026-08-23 sur les 259
// groupes actifs — 97 des 106 rookies (debut ≥ 2024) ont leur agence, contre
// **5 des 41 vétérans** (debut < 2020). La page BTS affiche « debut 2013 » nu
// pendant qu'un rookie inconnu affiche « XYZ Entertainment · debut 2026 ».
// `fandom_name` : 6 lignes sur 259.
//
//   npx tsx scripts/backfill-group-meta.ts            (revue, n'écrit rien)
//   npx tsx scripts/backfill-group-meta.ts --apply
//   npx tsx scripts/backfill-group-meta.ts --limit 20
//
// Garde-fous :
//  - **jamais d'écrasement** : on ne remplit que les colonnes vides ;
//  - **matching strict** du nom avant d'écrire (la recherche fandom renvoie
//    volontiers un homonyme ou un membre) ;
//  - **solistes exclus** : leur `{{Infobox person}}` n'a pas de champ `label` ;
//  - throttle 1 req/s, source tierce.
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { fetchInfobox, searchPageIds } from '../src/lib/scrapers/debuts/fandom'
import { normalize } from '../src/lib/scrapers/group-match'
import type { Database } from '../src/types/database'

loadEnvConfig(process.cwd())

const APPLY = process.argv.includes('--apply')
const LIMIT = (() => {
  const i = process.argv.indexOf('--limit')
  return i >= 0 ? Number(process.argv[i + 1]) : Infinity
})()

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data, error } = await supabase
    .from('groups')
    .select('id, name, slug, agency, fandom_name, name_aliases, is_solo, disbanded_on')
    .eq('is_solo', false)
    .is('disbanded_on', null)
    .order('name')
  if (error) throw new Error(error.message)

  const targets = (data ?? []).filter((g) => !g.agency?.trim() || !g.fandom_name?.trim())
  console.log(`${(data ?? []).length} groupes actifs — ${targets.length} avec une méta manquante`)

  let filled = 0
  let unmatched = 0
  let noData = 0

  for (const g of targets.slice(0, LIMIT)) {
    const ids = await searchPageIds(g.name, 3)
    await sleep(1000)
    if (ids.length === 0) {
      unmatched++
      console.log(`  ? ${g.name} — aucune page fandom`)
      continue
    }

    let hit: Awaited<ReturnType<typeof fetchInfobox>>['infobox'] = null
    for (const id of ids) {
      const { infobox } = await fetchInfobox(id)
      await sleep(1000)
      if (!infobox?.name) continue
      // Matching STRICT : égalité normalisée sur le nom ou un alias connu.
      // La recherche fandom renvoie volontiers un homonyme ou un membre, et
      // une agence attribuée au mauvais groupe s'afficherait comme un fait.
      const needle = normalize(infobox.name)
      const ours = [g.name, ...(g.name_aliases ?? [])].map(normalize)
      if (ours.includes(needle)) {
        hit = infobox
        break
      }
    }
    if (!hit) {
      unmatched++
      console.log(`  ? ${g.name} — page trouvée mais nom non concordant`)
      continue
    }

    const patch: { agency?: string; fandom_name?: string } = {}
    if (!g.agency?.trim() && hit.label) patch.agency = hit.label
    if (!g.fandom_name?.trim() && hit.fandomName) patch.fandom_name = hit.fandomName
    if (Object.keys(patch).length === 0) {
      noData++
      console.log(`  · ${g.name} — l'infobox n'a ni label ni fandom`)
      continue
    }

    filled++
    console.log(
      `  → ${g.name} : ${[patch.agency && `agency=${patch.agency}`, patch.fandom_name && `fandom=${patch.fandom_name}`].filter(Boolean).join(' | ')}`,
    )
    if (!APPLY) continue
    const { error: upErr } = await supabase.from('groups').update(patch).eq('id', g.id)
    if (upErr) console.error(`      ✗ ${upErr.message}`)
  }

  console.log(
    `\n${filled} groupes ${APPLY ? 'complétés' : 'à compléter (relancer avec --apply)'} · ${unmatched} sans page concordante · ${noData} sans donnée dans l'infobox`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
