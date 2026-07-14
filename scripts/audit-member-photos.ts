// Audit de la classe « photo membre stale » (R8.1) : un membre actif dont la
// photo n'a jamais été sourcée depuis fandom (photo_source_key null) garde une
// vieille image → incohérence d'ère quand ses coéquipiers, eux, sont sourcés.
// Ce script SURFACE la classe (total + groupes à sourcing MIXTE) pour piloter
// les passes de `refresh-images-once --stale` et repérer les régressions.
//
//   npx tsx scripts/audit-member-photos.ts
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database'

loadEnvConfig(process.cwd())

async function main() {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Membres ACTIFS avec une photo affichée. ~670 rows < cap 1000.
  const { data, error } = await supabase
    .from('members')
    .select('stage_name, photo_source_key, groups!inner(name)')
    .eq('status', 'active')
    .not('photo_url', 'is', null)
    .limit(2000)
  if (error) throw new Error(error.message)
  if ((data?.length ?? 0) >= 2000) console.warn('⚠️ cap 2000 atteint — résultats tronqués')

  type Row = { name: string; sourced: number; stale: number; staleNames: string[] }
  const byGroup = new Map<string, Row>()
  let totalStale = 0
  for (const m of data ?? []) {
    const name = m.groups.name
    const row = byGroup.get(name) ?? { name, sourced: 0, stale: 0, staleNames: [] }
    if (m.photo_source_key) row.sourced++
    else {
      row.stale++
      row.staleNames.push(m.stage_name)
      totalStale++
    }
    byGroup.set(name, row)
  }

  // Groupes MIXTES (au moins un sourcé ET un stale) = incohérence d'ère visible.
  const mixed = [...byGroup.values()]
    .filter((r) => r.sourced > 0 && r.stale > 0)
    .sort((a, b) => b.stale - a.stale)
  // Groupes 100 % stale (aucun membre sourcé) — cohérents mais tous datés.
  const allStale = [...byGroup.values()]
    .filter((r) => r.sourced === 0 && r.stale > 0)
    .sort((a, b) => b.stale - a.stale)

  console.log(`\n=== Photos membres stale (photo_source_key null, actifs) ===`)
  console.log(`Total stale : ${totalStale} sur ${data?.length ?? 0} membres actifs avec photo`)

  console.log(`\n— Groupes à sourcing MIXTE (${mixed.length}) : split d'ère visible —`)
  for (const r of mixed) {
    console.log(
      `  ${r.name} — ${r.stale} stale / ${r.sourced + r.stale} : ${r.staleNames.join(', ')}`,
    )
  }

  console.log(`\n— Groupes 100 % stale (${allStale.length}) : datés mais cohérents —`)
  for (const r of allStale) console.log(`  ${r.name} — ${r.stale} : ${r.staleNames.join(', ')}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
