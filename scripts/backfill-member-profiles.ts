/**
 * Backfill `members.slug` (composite `{group_slug}-{stage_name}`) + overrides
 * lifecycle pour les cas connus (Youngseo ILLIT → pre_debut, Soojin i-dle → former).
 *
 * Idempotent : skip si `slug is not null` ET status déjà défini autrement que default.
 * Collisions résolues par suffixe `-2`, `-3`, … (rare : composite global, mais sécurité).
 *
 *   npx tsx scripts/backfill-member-profiles.ts            (dry-run)
 *   npx tsx scripts/backfill-member-profiles.ts --write    (applique)
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { buildMemberSlug } from '../src/lib/members/slug'
import type { Database, TablesUpdate } from '../src/types/database'

type MemberPatch = TablesUpdate<'members'>

loadEnvConfig(process.cwd())
const WRITE = process.argv.includes('--write')

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// Overrides ciblés. Match (groupSlug, stageName) insensible à la casse.
// Vide pour les autres → reste `active` (default DB).
type Override = {
  groupSlug: string
  stageName: string
  status: 'former' | 'pre_debut'
  formerReason: string | null
}
const OVERRIDES: Override[] = [
  {
    groupSlug: 'idle',
    stageName: 'soojin',
    status: 'former',
    formerReason: 'Left the group in August 2021',
  },
  {
    groupSlug: 'illit',
    stageName: 'youngseo',
    status: 'pre_debut',
    formerReason: null,
  },
]

function matchOverride(groupSlug: string, stageName: string): Override | undefined {
  const key = stageName.toLowerCase()
  return OVERRIDES.find((o) => o.groupSlug === groupSlug && o.stageName === key)
}

async function main() {
  const { data: members, error } = await supabase
    .from('members')
    .select('id, stage_name, slug, status, former_reason, group:groups!inner(slug)')
  if (error) throw error
  if (!members || members.length === 0) {
    console.log('No members in DB.')
    return
  }

  // Réserve les slugs déjà pris pour collision-resolution intra-run.
  const taken = new Set<string>(members.map((m) => m.slug).filter((s): s is string => Boolean(s)))

  const updates: {
    id: string
    stageName: string
    groupSlug: string
    slug: string | null
    status: 'active' | 'former' | 'pre_debut' | null
    formerReason: string | null
    changes: string[]
  }[] = []

  for (const m of members) {
    const groupSlug = (m.group as { slug: string } | null)?.slug
    if (!groupSlug) {
      console.warn(`Skip ${m.id}: no group slug`)
      continue
    }

    const changes: string[] = []
    let newSlug: string | null = m.slug
    if (!m.slug) {
      const base = buildMemberSlug(groupSlug, m.stage_name)
      let candidate = base || `member-${m.id.slice(0, 8)}`
      let i = 2
      while (taken.has(candidate)) {
        candidate = `${base}-${i++}`
      }
      taken.add(candidate)
      newSlug = candidate
      changes.push(`slug=${candidate}`)
    }

    const override = matchOverride(groupSlug, m.stage_name)
    let newStatus: 'active' | 'former' | 'pre_debut' | null = null
    let newFormerReason: string | null = null
    if (override && m.status !== override.status) {
      newStatus = override.status
      newFormerReason = override.formerReason
      changes.push(`status=${override.status}`)
      if (override.formerReason) changes.push(`former_reason="${override.formerReason}"`)
    }

    if (changes.length > 0) {
      updates.push({
        id: m.id,
        stageName: m.stage_name,
        groupSlug,
        slug: newSlug,
        status: newStatus,
        formerReason: newFormerReason,
        changes,
      })
    }
  }

  console.log(`Backfill plan : ${updates.length} members to update`)
  for (const u of updates) {
    const tag = `${u.groupSlug}/${u.stageName}`.padEnd(40)
    console.log(`  ${tag} ${u.changes.join(', ')}`)
  }

  if (!WRITE) {
    console.log('\nDry-run. Pass --write to apply.')
    return
  }

  let okCount = 0
  for (const u of updates) {
    const patch: MemberPatch = {}
    if (u.slug !== null) patch.slug = u.slug
    if (u.status !== null) patch.status = u.status
    // former_reason : on l'écrit même si null pour reset des cas accidentels.
    if (u.status !== null) patch.former_reason = u.formerReason
    const { error: upErr } = await supabase.from('members').update(patch).eq('id', u.id)
    if (upErr) console.error(`  FAIL ${u.id}: ${upErr.message}`)
    else okCount++
  }
  console.log(`\nUpdated ${okCount}/${updates.length} members.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
