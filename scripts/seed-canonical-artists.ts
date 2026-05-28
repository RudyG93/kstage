/**
 * Seed one-shot pour la "page unique par artiste" (PR-D-3.1) :
 *
 *  - Crée le groupe `alldayproject` (The Black Label, debut 2025-06-23) + 5 membres
 *    (Annie, Bailey, Tarzzan, Woochan, Youngseo) — lineup vérifié Wikipedia 2026-05-29.
 *  - Crée le groupe `soojin` solo (BRD, solo debut 2023-11-08 Agassy EP) + 1 membre.
 *  - Linke `members.canonical_id` :
 *      illit-youngseo (pre_debut) → alldayproject-youngseo
 *      idle-soojin (former)        → soojin (solo)
 *
 * Idempotent : skip insert si group.slug ou member.slug existe déjà.
 *
 *   npx tsx scripts/seed-canonical-artists.ts            (dry-run)
 *   npx tsx scripts/seed-canonical-artists.ts --write    (applique)
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { buildMemberSlug } from '../src/lib/members/slug'
import type { Database } from '../src/types/database'

loadEnvConfig(process.cwd())
const WRITE = process.argv.includes('--write')

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// ---------- Data ----------

const ALLDAYPROJECT = {
  slug: 'alldayproject',
  name: 'Allday Project',
  agency: 'The Black Label',
  fandom_name: 'Day One',
  debut_date: '2025-06-23',
  members: [
    { stage_name: 'Annie', real_name: 'Annie Moon' },
    { stage_name: 'Bailey', real_name: 'Bailey Sok' },
    { stage_name: 'Tarzzan', real_name: null },
    { stage_name: 'Woochan', real_name: 'Jo Woo-chan' },
    { stage_name: 'Youngseo', real_name: null },
  ],
}

const SOOJIN_SOLO = {
  slug: 'soojin',
  name: 'Soojin',
  agency: 'BRD',
  fandom_name: null,
  debut_date: '2023-11-08',
  member: { stage_name: 'Soojin', real_name: 'Seo Soo-jin' },
}

// Historiques à relier (group_slug, member_stage_name).
const CANONICAL_LINKS: {
  historical: { groupSlug: string; stageName: string }
  canonical: { groupSlug: string; stageName: string }
}[] = [
  {
    historical: { groupSlug: 'illit', stageName: 'Youngseo' },
    canonical: { groupSlug: 'alldayproject', stageName: 'Youngseo' },
  },
  {
    historical: { groupSlug: 'idle', stageName: 'Soojin' },
    canonical: { groupSlug: 'soojin', stageName: 'Soojin' },
  },
]

// ---------- Helpers ----------

async function getGroupBySlug(slug: string) {
  const { data } = await supabase
    .from('groups')
    .select('id, slug, name')
    .eq('slug', slug)
    .maybeSingle()
  return data
}

async function getMemberByGroupAndName(groupSlug: string, stageName: string) {
  const { data } = await supabase
    .from('members')
    .select('id, slug, stage_name, canonical_id, groups!inner(slug)')
    .eq('stage_name', stageName)
    .eq('groups.slug', groupSlug)
    .maybeSingle()
  return data
}

// ---------- Main ----------

async function main() {
  const summary: string[] = []

  // 1. Allday Project group
  let adp = await getGroupBySlug(ALLDAYPROJECT.slug)
  if (adp) {
    summary.push(`✓ group ${ALLDAYPROJECT.slug} already exists (id=${adp.id})`)
  } else {
    summary.push(`+ group ${ALLDAYPROJECT.slug} (${ALLDAYPROJECT.name})`)
    if (WRITE) {
      const { data, error } = await supabase
        .from('groups')
        .insert({
          slug: ALLDAYPROJECT.slug,
          name: ALLDAYPROJECT.name,
          agency: ALLDAYPROJECT.agency,
          fandom_name: ALLDAYPROJECT.fandom_name,
          debut_date: ALLDAYPROJECT.debut_date,
        })
        .select('id, slug, name')
        .single()
      if (error) throw new Error(`insert group ${ALLDAYPROJECT.slug}: ${error.message}`)
      adp = data
    }
  }

  // 2. Allday Project members
  for (const m of ALLDAYPROJECT.members) {
    const memberSlug = buildMemberSlug(ALLDAYPROJECT.slug, m.stage_name)
    const existing = await getMemberByGroupAndName(ALLDAYPROJECT.slug, m.stage_name)
    if (existing) {
      summary.push(`✓ member ${memberSlug} already exists`)
      continue
    }
    summary.push(`+ member ${memberSlug} (${m.stage_name})`)
    if (WRITE && adp) {
      const { error } = await supabase.from('members').insert({
        group_id: adp.id,
        stage_name: m.stage_name,
        real_name: m.real_name,
        slug: memberSlug,
        status: 'active',
      })
      if (error) throw new Error(`insert member ${memberSlug}: ${error.message}`)
    }
  }

  // 3. Soojin solo group
  let soojinGroup = await getGroupBySlug(SOOJIN_SOLO.slug)
  if (soojinGroup) {
    summary.push(`✓ group ${SOOJIN_SOLO.slug} already exists (id=${soojinGroup.id})`)
  } else {
    summary.push(`+ group ${SOOJIN_SOLO.slug} (${SOOJIN_SOLO.name})`)
    if (WRITE) {
      const { data, error } = await supabase
        .from('groups')
        .insert({
          slug: SOOJIN_SOLO.slug,
          name: SOOJIN_SOLO.name,
          agency: SOOJIN_SOLO.agency,
          fandom_name: SOOJIN_SOLO.fandom_name,
          debut_date: SOOJIN_SOLO.debut_date,
        })
        .select('id, slug, name')
        .single()
      if (error) throw new Error(`insert group ${SOOJIN_SOLO.slug}: ${error.message}`)
      soojinGroup = data
    }
  }

  // 4. Soojin solo member
  {
    const memberSlug = buildMemberSlug(SOOJIN_SOLO.slug, SOOJIN_SOLO.member.stage_name)
    const existing = await getMemberByGroupAndName(SOOJIN_SOLO.slug, SOOJIN_SOLO.member.stage_name)
    if (existing) {
      summary.push(`✓ member ${memberSlug} already exists`)
    } else {
      summary.push(`+ member ${memberSlug} (${SOOJIN_SOLO.member.stage_name}, Soloist)`)
      if (WRITE && soojinGroup) {
        const { error } = await supabase.from('members').insert({
          group_id: soojinGroup.id,
          stage_name: SOOJIN_SOLO.member.stage_name,
          real_name: SOOJIN_SOLO.member.real_name,
          slug: memberSlug,
          status: 'active',
          position: 'Soloist',
        })
        if (error) throw new Error(`insert member ${memberSlug}: ${error.message}`)
      }
    }
  }

  // 5. Canonical links
  for (const link of CANONICAL_LINKS) {
    const historical = await getMemberByGroupAndName(
      link.historical.groupSlug,
      link.historical.stageName,
    )
    const canonical = await getMemberByGroupAndName(
      link.canonical.groupSlug,
      link.canonical.stageName,
    )
    if (!historical || !canonical) {
      summary.push(
        `! skip link ${link.historical.groupSlug}/${link.historical.stageName} → ${link.canonical.groupSlug}/${link.canonical.stageName} (missing rows)`,
      )
      continue
    }
    if (historical.canonical_id === canonical.id) {
      summary.push(
        `✓ link ${historical.slug ?? historical.id} → ${canonical.slug ?? canonical.id} already set`,
      )
      continue
    }
    summary.push(`+ link ${historical.slug ?? historical.id} → ${canonical.slug ?? canonical.id}`)
    if (WRITE) {
      const { error } = await supabase
        .from('members')
        .update({ canonical_id: canonical.id })
        .eq('id', historical.id)
      if (error) throw new Error(`link ${historical.id}: ${error.message}`)
    }
  }

  console.log(`\n=== ${WRITE ? 'WRITE' : 'DRY-RUN'} ===`)
  for (const line of summary) console.log(`  ${line}`)
  if (!WRITE) console.log('\nDry-run. Pass --write to apply.')
  else console.log('\nDone.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
