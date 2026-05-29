/**
 * Backfill `members.photo_url` + `real_name` + `birthday` depuis kpopnet.json
 * (CC0, GitHub raw, figé 2023-11-24 → couvre groupes pre-2024 dont aespa/i-dle).
 *
 * Stratégie : match par nom normalisé `norm()` (groupe → liste d'idol_ids →
 * idols → member). N'**écrase jamais** une valeur déjà présente en DB :
 * idempotent + safe en re-run.
 *
 * Cache local : `scripts/roster/out/kpopnet-cache.json` (TTL 24h, écrasé sinon).
 *
 *   npx tsx scripts/roster/seed-photos-realnames.ts            (dry-run)
 *   npx tsx scripts/roster/seed-photos-realnames.ts --write    (applique)
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import type { Database } from '../../src/types/database'

loadEnvConfig(process.cwd())
const WRITE = process.argv.includes('--write')
const KPOPNET_URL = 'https://raw.githubusercontent.com/kpopnet/kpopnet.json/master/kpopnet.json'
const CACHE_PATH = 'scripts/roster/out/kpopnet-cache.json'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '')

// Variantes de nom DB ↔ kpopnet non couvertes par la normalisation simple.
// Aligné avec `src/lib/scrapers/kpopofficial.ts:80` GROUP_ALIASES (sens inverse :
// ici on map le norm DB vers le norm kpopnet pour trouver la row kpopnet).
const DB_TO_KPOPNET_ALIAS: Record<string, string> = {
  idle: 'gidle', // DB "i-dle" → kpopnet "(G)I-DLE"
}

interface KpopnetIdol {
  id: string
  name: string
  real_name?: string | null
  birth_date?: string | null
  thumb_url?: string | null
  groups?: string[] | null
}
interface KpopnetGroupMember {
  idol_id: string
  current: boolean
  roles?: string | null
}
interface KpopnetGroup {
  id: string
  name: string
  members?: KpopnetGroupMember[] | null
}
interface Kpopnet {
  idols: KpopnetIdol[]
  groups: KpopnetGroup[]
}

async function loadKpopnet(): Promise<Kpopnet> {
  if (existsSync(CACHE_PATH)) {
    const age = Date.now() - statSync(CACHE_PATH).mtimeMs
    if (age < CACHE_TTL_MS) {
      console.log(`Using cached kpopnet (${Math.round(age / 1000 / 60)} min old)`)
      return JSON.parse(readFileSync(CACHE_PATH, 'utf8'))
    }
  }
  console.log('Fetching kpopnet.json…')
  const res = await fetch(KPOPNET_URL)
  if (!res.ok) throw new Error(`kpopnet fetch failed: ${res.status}`)
  const data = (await res.json()) as Kpopnet
  mkdirSync('scripts/roster/out', { recursive: true })
  writeFileSync(CACHE_PATH, JSON.stringify(data))
  console.log(`Fetched: ${data.idols.length} idols, ${data.groups.length} groups`)
  return data
}

async function main() {
  const kpopnet = await loadKpopnet()
  const idolsById = new Map(kpopnet.idols.map((i) => [i.id, i]))
  const groupsByNorm = new Map<string, KpopnetGroup>()
  for (const g of kpopnet.groups) groupsByNorm.set(norm(g.name), g)

  const { data: dbGroups, error: gErr } = await supabase.from('groups').select('id, slug, name')
  if (gErr) throw gErr
  const { data: dbMembers, error: mErr } = await supabase
    .from('members')
    .select('id, group_id, stage_name, photo_url, real_name, birthday, canonical_id')
  if (mErr) throw mErr

  const membersByGroup = new Map<string, typeof dbMembers>()
  for (const m of dbMembers ?? []) {
    if (!membersByGroup.has(m.group_id)) membersByGroup.set(m.group_id, [])
    membersByGroup.get(m.group_id)!.push(m)
  }

  type Patch = {
    id: string
    groupSlug: string
    stageName: string
    photo_url?: string | null
    real_name?: string | null
    birthday?: string | null
  }
  const patches: Patch[] = []
  const unmatchedGroups: string[] = []
  const unmatchedMembers: string[] = []
  let groupMatches = 0

  for (const g of dbGroups ?? []) {
    const nameKey = norm(g.name)
    const aliasKey = DB_TO_KPOPNET_ALIAS[nameKey]
    const kg = groupsByNorm.get(nameKey) ?? (aliasKey ? groupsByNorm.get(aliasKey) : undefined)
    if (!kg) {
      unmatchedGroups.push(g.slug)
      continue
    }
    groupMatches++
    const targetIdols = (kg.members ?? [])
      .map((m) => idolsById.get(m.idol_id))
      .filter((i): i is KpopnetIdol => Boolean(i))
    const targetByNorm = new Map(targetIdols.map((i) => [norm(i.name), i]))

    const dbMembersForGroup = membersByGroup.get(g.id) ?? []
    for (const m of dbMembersForGroup) {
      const ki = targetByNorm.get(norm(m.stage_name))
      if (!ki) {
        unmatchedMembers.push(`${g.slug}/${m.stage_name}`)
        continue
      }
      const patch: Patch = { id: m.id, groupSlug: g.slug, stageName: m.stage_name }
      let hasChange = false
      if (!m.photo_url && ki.thumb_url) {
        patch.photo_url = ki.thumb_url
        hasChange = true
      }
      if (!m.real_name && ki.real_name) {
        patch.real_name = ki.real_name
        hasChange = true
      }
      if (!m.birthday && ki.birth_date && /^\d{4}-\d{2}-\d{2}$/.test(ki.birth_date)) {
        patch.birthday = ki.birth_date
        hasChange = true
      }
      if (hasChange) patches.push(patch)
    }
  }

  // Post-pass : propage vers le canonical quand l'historique a un patch mais
  // que le canonique lui-même n'a pas trouvé sa propre row kpopnet (cas Soojin
  // solo, ALLDAY PROJECT Youngseo — leur groupe actuel est post-freeze).
  // Une vieille photo d'époque vaut mieux qu'un placeholder gradient.
  const patchedById = new Map(patches.map((p) => [p.id, p]))
  const canonicalsById = new Map(
    (dbMembers ?? []).filter((m) => !m.canonical_id).map((m) => [m.id, m]),
  )
  let propagated = 0
  for (const m of dbMembers ?? []) {
    if (!m.canonical_id) continue
    const canonical = canonicalsById.get(m.canonical_id)
    if (!canonical) continue
    if (patchedById.has(canonical.id)) continue
    const hp = patchedById.get(m.id)
    if (!hp) continue
    const patch: Patch = {
      id: canonical.id,
      groupSlug: '(propagated)',
      stageName: canonical.stage_name,
    }
    let hasChange = false
    if (!canonical.photo_url && hp.photo_url) {
      patch.photo_url = hp.photo_url
      hasChange = true
    }
    if (!canonical.real_name && hp.real_name) {
      patch.real_name = hp.real_name
      hasChange = true
    }
    if (!canonical.birthday && hp.birthday) {
      patch.birthday = hp.birthday
      hasChange = true
    }
    if (hasChange) {
      patches.push(patch)
      patchedById.set(canonical.id, patch)
      propagated++
    }
  }
  if (propagated > 0)
    console.log(`Canonical propagation : ${propagated} rows inherit from historicals`)

  const photoUpdates = patches.filter((p) => p.photo_url !== undefined).length
  const nameUpdates = patches.filter((p) => p.real_name !== undefined).length
  const bdayUpdates = patches.filter((p) => p.birthday !== undefined).length

  console.log(`\n=== ${WRITE ? 'WRITE' : 'DRY-RUN'} ===`)
  console.log(
    `Groups in DB: ${dbGroups?.length ?? 0} | matched in kpopnet: ${groupMatches} | unmatched: ${unmatchedGroups.length}`,
  )
  console.log(
    `Members to update: ${patches.length} (photo=${photoUpdates}, real_name=${nameUpdates}, birthday=${bdayUpdates})`,
  )
  console.log(`Unmatched members in matched groups: ${unmatchedMembers.length}`)

  // Focus MVP groups dans le log : on veut voir l'effet sur aespa/idle d'abord.
  const mvp = new Set(['aespa', 'illit', 'babymonster', 'idle', 'alldayproject', 'soojin'])
  const mvpPatches = patches.filter((p) => mvp.has(p.groupSlug))
  if (mvpPatches.length > 0) {
    console.log('\nMVP coverage :')
    for (const p of mvpPatches) {
      const tags: string[] = []
      if (p.photo_url !== undefined) tags.push('photo')
      if (p.real_name !== undefined) tags.push(`real_name="${p.real_name}"`)
      if (p.birthday !== undefined) tags.push(`birthday=${p.birthday}`)
      console.log(`  ${p.groupSlug}/${p.stageName.padEnd(20)} ${tags.join(', ')}`)
    }
  }
  const mvpUnmatched = unmatchedGroups.filter((s) => mvp.has(s))
  if (mvpUnmatched.length > 0) console.log(`MVP unmatched groups: ${mvpUnmatched.join(', ')}`)

  if (!WRITE) {
    console.log('\nDry-run. Pass --write to apply.')
    return
  }

  let ok = 0
  for (const p of patches) {
    const update: {
      photo_url?: string | null
      real_name?: string | null
      birthday?: string | null
    } = {}
    if (p.photo_url !== undefined) update.photo_url = p.photo_url
    if (p.real_name !== undefined) update.real_name = p.real_name
    if (p.birthday !== undefined) update.birthday = p.birthday
    const { error } = await supabase.from('members').update(update).eq('id', p.id)
    if (error) console.error(`  FAIL ${p.groupSlug}/${p.stageName}: ${error.message}`)
    else ok++
  }
  console.log(`\nDone. Updated ${ok}/${patches.length} members.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
