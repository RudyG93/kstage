/**
 * Seed la roster validée (scripts/roster/out/roster-dryrun.json) dans Supabase.
 * Dry-run par défaut (affiche le plan) ; `--write` exécute via service_role.
 *
 *   npx tsx scripts/roster/seed-roster.ts            (dry-run)
 *   npx tsx scripts/roster/seed-roster.ts --write     (insertion réelle)
 *
 * - slug = nom normalisé (reproduit les slugs existants : aespa, illit, idle…).
 * - Groupes existants (match par slug) → update image/debut, sans clobber le nom.
 * - Membres (girls kpopnet) : delete+insert pour idempotence.
 */
import { loadEnvConfig } from '@next/env'
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

loadEnvConfig(process.cwd())
const WRITE = process.argv.includes('--write')

interface RosterRow {
  name: string
  gender: string
  debut: string | null
  source: string
  memberData: { stage_name: string; birthday: string | null }[]
  fans: number
  imageUrl: string | null
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '')

async function main() {
  const rows = JSON.parse(
    readFileSync('scripts/roster/out/roster-dryrun.json', 'utf8'),
  ) as RosterRow[]

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: existing, error: exErr } = await supabase.from('groups').select('id, slug, name')
  if (exErr) throw exErr
  const existingBySlug = new Map((existing ?? []).map((g) => [g.slug, g]))

  // dédup slug au sein de la roster
  const seen = new Set<string>()
  const plan = rows.map((r) => {
    let slug = slugify(r.name)
    while (seen.has(slug) && !existingBySlug.has(slug)) slug = slug + 'x'
    seen.add(slug)
    return { row: r, slug, exists: existingBySlug.has(slug) }
  })

  const toInsert = plan.filter((p) => !p.exists)
  const toUpdate = plan.filter((p) => p.exists)
  const withMembers = plan.filter((p) => p.row.memberData.length > 0)
  const totalMembers = withMembers.reduce((n, p) => n + p.row.memberData.length, 0)
  const noDebut = plan.filter((p) => !p.row.debut)
  const noImage = plan.filter((p) => !p.row.imageUrl)

  console.log(`\n=== SEED PLAN (${WRITE ? 'WRITE' : 'DRY-RUN'}) ===`)
  console.log(
    `Roster: ${rows.length} | new inserts: ${toInsert.length} | existing updates: ${toUpdate.length}`,
  )
  console.log(`Groups with members to seed: ${withMembers.length} (${totalMembers} member rows)`)
  console.log(`Missing debut: ${noDebut.length} | missing image: ${noImage.length}`)
  console.log(`Existing matched: ${toUpdate.map((p) => p.slug).join(', ') || '—'}`)
  console.log(
    'Sample new:',
    toInsert
      .slice(0, 8)
      .map((p) => `${p.row.name}→${p.slug}`)
      .join(', '),
  )

  if (!WRITE) {
    console.log('\nDry-run only. Re-run with --write to apply.')
    return
  }

  let gOk = 0
  let mRows = 0
  for (const p of plan) {
    let groupId: string
    if (p.exists) {
      // existant : UPDATE par id (ne clobber pas le nom curé ; pas d'INSERT donc pas de NOT NULL)
      const ex = existingBySlug.get(p.slug)!
      const { error } = await supabase
        .from('groups')
        .update({ debut_date: p.row.debut, image_url: p.row.imageUrl })
        .eq('id', ex.id)
      if (error) {
        console.error(`group ${p.slug} update failed:`, error.message)
        continue
      }
      groupId = ex.id
    } else {
      const { data: up, error } = await supabase
        .from('groups')
        .insert({
          slug: p.slug,
          name: p.row.name,
          debut_date: p.row.debut,
          image_url: p.row.imageUrl,
        })
        .select('id')
        .single()
      if (error) {
        console.error(`group ${p.slug} insert failed:`, error.message)
        continue
      }
      groupId = up.id
    }
    gOk++

    if (p.row.memberData.length > 0) {
      await supabase.from('members').delete().eq('group_id', groupId)
      const { error: mErr } = await supabase.from('members').insert(
        p.row.memberData.map((m) => ({
          group_id: groupId,
          stage_name: m.stage_name,
          birthday: m.birthday,
        })),
      )
      if (mErr) console.error(`members for ${p.slug} failed:`, mErr.message)
      else mRows += p.row.memberData.length
    }
  }
  console.log(`\nDone. Groups upserted: ${gOk} | member rows inserted: ${mRows}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
