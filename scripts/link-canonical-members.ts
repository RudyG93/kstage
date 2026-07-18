// Sweep one-shot des personnes dupliquées cross-groupe (round 2026-07-18,
// cas SuA/JiU/Yoohyeon recréées par la création du sub-unit UAU) : propose des
// liens canonical_id sur preuve FORTE (isSamePerson — real_name normalisé égal,
// ou birthday égal + stage name égal), canonique = row la plus ANCIENNE
// (convention seed-canonical-artists : le groupe principal précède le side
// project). Dry-run par défaut ; --apply pour écrire.
//
//   npx tsx scripts/link-canonical-members.ts            (dry-run)
//   npx tsx scripts/link-canonical-members.ts --apply
//   npx tsx scripts/link-canonical-members.ts --apply --only=uau-sua,uau-jiu
//     (--only : n'écrit que les rows listées — les autres restent en dry)
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database'
import { isSamePerson, type PersonEvidence } from '../src/lib/members/matching'

loadEnvConfig(process.cwd())

const APPLY = process.argv.includes('--apply')
const ONLY =
  process.argv
    .find((a) => a.startsWith('--only='))
    ?.slice(7)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean) ?? null

type Row = PersonEvidence & { slug: string; created_at: string; group_name: string }

async function main() {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const rows: Row[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('members')
      .select(
        'id, slug, stage_name, real_name, birthday, canonical_id, group_id, created_at, groups!inner(name)',
      )
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    for (const m of data ?? []) {
      rows.push({
        id: m.id,
        slug: m.slug ?? '',
        stage_name: m.stage_name,
        real_name: m.real_name,
        birthday: m.birthday,
        canonical_id: m.canonical_id,
        group_id: m.group_id,
        created_at: m.created_at,
        group_name: (m.groups as { name: string }).name,
      })
    }
    if (!data || data.length < 1000) break
  }

  // Clusters de même personne parmi les rows encore canoniques (union naïve —
  // les clusters réels font 2-3 rows, le O(n²) sur ~850 rows est instantané).
  const canonical = rows.filter((r) => r.canonical_id == null)
  const clusterOf = new Map<string, Set<Row>>()
  for (let i = 0; i < canonical.length; i++) {
    for (let j = i + 1; j < canonical.length; j++) {
      const a = canonical[i]
      const b = canonical[j]
      if (a.group_id === b.group_id || !isSamePerson(a, b)) continue
      const cluster = clusterOf.get(a.id) ?? clusterOf.get(b.id) ?? new Set<Row>()
      cluster.add(a)
      cluster.add(b)
      clusterOf.set(a.id, cluster)
      clusterOf.set(b.id, cluster)
    }
  }
  const clusters = [...new Set(clusterOf.values())]

  if (clusters.length === 0) {
    console.log('Aucune personne dupliquée détectée.')
    return
  }

  let applied = 0
  for (const cluster of clusters) {
    const sorted = [...cluster].sort((a, b) => a.created_at.localeCompare(b.created_at))
    const target = sorted[0]
    const links = sorted.slice(1)
    console.log(
      `\nPersonne : ${target.stage_name} — canonique = ${target.slug} (${target.group_name}, ${target.created_at.slice(0, 10)})`,
    )
    for (const l of links) {
      const write = APPLY && (!ONLY || ONLY.includes(l.slug))
      console.log(
        `  ${write ? '→' : '[dry]'} ${l.slug || l.stage_name} (${l.group_name}) → canonical ${target.slug || target.stage_name}`,
      )
      if (write) {
        const { error } = await supabase
          .from('members')
          .update({ canonical_id: target.id })
          .eq('id', l.id)
        if (error) console.error(`  ✗ ${l.slug}: ${error.message}`)
        else applied++
      }
    }
  }
  console.log(
    `\n${clusters.length} cluster(s), ${clusters.reduce((a, c) => a + c.size - 1, 0)} lien(s) ${APPLY ? `— ${applied} appliqués` : '(dry-run, rien écrit)'}`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
