/**
 * Backfill : détecte le `mv_kind` et `member_id` pour tous les events
 * `type='mv'` existants en utilisant `detectMvVersion`. Migration 0010 a
 * initialisé tous les MV à `mv_kind='main'` ; ce script reclasse ceux qui
 * sont en réalité Performance/Member/Other_Version.
 *
 *   npx tsx scripts/backfill-mv-versions.ts            (dry-run)
 *   npx tsx scripts/backfill-mv-versions.ts --write    (applique)
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { detectMvVersion, type MemberRef } from '../src/lib/scrapers/mv-version'
import type { Database } from '../src/types/database'

loadEnvConfig(process.cwd())
const WRITE = process.argv.includes('--write')

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function main() {
  const { data: events, error: evErr } = await supabase
    .from('events')
    .select('id, title, group_id, mv_kind, member_id')
    .eq('type', 'mv')
  if (evErr) throw evErr
  if (!events || events.length === 0) {
    console.log('No type="mv" events. Nothing to do.')
    return
  }

  const { data: members, error: mErr } = await supabase
    .from('members')
    .select('id, group_id, stage_name')
  if (mErr) throw mErr

  // Index members par group_id pour lookup O(1).
  const byGroup = new Map<string, MemberRef[]>()
  for (const m of members ?? []) {
    const arr = byGroup.get(m.group_id) ?? []
    arr.push({ id: m.id, stage_name: m.stage_name })
    byGroup.set(m.group_id, arr)
  }

  type Change = {
    id: string
    title: string
    fromKind: string | null
    toKind: 'main' | 'performance' | 'member' | 'other_version'
    fromMemberId: string | null
    toMemberId: string | null
  }
  const changes: Change[] = []

  for (const e of events) {
    const groupMembers = byGroup.get(e.group_id) ?? []
    const v = detectMvVersion(e.title, groupMembers)
    if (v.kind !== e.mv_kind || v.memberId !== e.member_id) {
      changes.push({
        id: e.id,
        title: e.title,
        fromKind: e.mv_kind,
        toKind: v.kind,
        fromMemberId: e.member_id,
        toMemberId: v.memberId,
      })
    }
  }

  console.log(`Audited ${events.length} MV rows, ${changes.length} changes detected.`)
  for (const c of changes) {
    console.log(
      `  [${c.id.slice(0, 8)}] ${c.fromKind ?? 'null'} → ${c.toKind}` +
        (c.toMemberId ? ` (member=${c.toMemberId.slice(0, 8)})` : '') +
        `  ${c.title}`,
    )
  }

  if (!WRITE) {
    console.log('\nDry-run. Pass --write to apply.')
    return
  }

  let ok = 0
  for (const c of changes) {
    // CHECK constraint : si toKind != 'member', member_id DOIT être null.
    // detectMvVersion garantit déjà cet invariant, mais on est défensif.
    const memberId = c.toKind === 'member' ? c.toMemberId : null
    const { error: upErr } = await supabase
      .from('events')
      .update({ mv_kind: c.toKind, member_id: memberId })
      .eq('id', c.id)
    if (upErr) console.error(`  FAIL ${c.id}: ${upErr.message}`)
    else ok++
  }
  console.log(`\nUpdated ${ok}/${changes.length} events.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
