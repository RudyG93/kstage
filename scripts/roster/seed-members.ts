/**
 * Remplit les membres des groupes SANS membres (boy groups + recents pré-2024)
 * depuis dbkpop all-idols (stage name + DOB + position). Match par nom normalisé.
 * Dry-run par défaut ; `--write` insère via service_role.
 *
 *   npx tsx scripts/roster/seed-members.ts
 *   npx tsx scripts/roster/seed-members.ts --write
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import * as cheerio from 'cheerio'

loadEnvConfig(process.cwd())
const WRITE = process.argv.includes('--write')
const IDOLS_URL = 'https://dbkpop.com/db/all-k-pop-idols/'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '')

interface Idol {
  stage_name: string
  real_name: string | null
  birthday: string | null
  groupNorm: string
  position: string | null
}

async function fetchIdols(): Promise<Map<string, Idol[]>> {
  const html = await (await fetch(IDOLS_URL, { headers: { 'User-Agent': UA } })).text()
  const $ = cheerio.load(html)
  const byGroup = new Map<string, Idol[]>()
  $('table')
    .first()
    .find('tbody tr')
    .each((_, tr) => {
      const c = $(tr)
        .find('td')
        .map((__, td) => $(td).text().trim())
        .get()
      // [Profile, Stage, Full, Korean, K.Stage, DOB, Group, Country, ...14 Gender, 15 Position]
      const stage = c[1]
      const dob = c[5]
      const group = c[6]
      if (!stage || !group) return
      const key = norm(group)
      const idol: Idol = {
        stage_name: stage,
        real_name: c[2] || null,
        birthday: /^\d{4}-\d{2}-\d{2}$/.test(dob) ? dob : null,
        groupNorm: key,
        position: c[15] || null,
      }
      if (!byGroup.has(key)) byGroup.set(key, [])
      byGroup.get(key)!.push(idol)
    })
  return byGroup
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: groups } = await supabase.from('groups').select('id, slug, name')
  const { data: members } = await supabase.from('members').select('group_id')
  const haveMembers = new Set((members ?? []).map((m) => m.group_id))
  const targets = (groups ?? []).filter((g) => !haveMembers.has(g.id))

  console.log(`Groups without members: ${targets.length}. Fetching dbkpop all-idols…`)
  const byGroup = await fetchIdols()
  console.log(`dbkpop idols indexed across ${byGroup.size} groups.\n`)

  const matched: { slug: string; n: number }[] = []
  const unmatched: string[] = []
  const inserts: {
    group_id: string
    stage_name: string
    real_name: string | null
    birthday: string | null
    position: string | null
  }[] = []

  for (const g of targets) {
    const idols = byGroup.get(g.slug) // slug = norm(name) ; idol group norm aligné (même source dbkpop)
    if (!idols || idols.length === 0) {
      unmatched.push(g.slug)
      continue
    }
    matched.push({ slug: g.slug, n: idols.length })
    for (const i of idols) {
      inserts.push({
        group_id: g.id,
        stage_name: i.stage_name,
        real_name: i.real_name,
        birthday: i.birthday,
        position: i.position,
      })
    }
  }

  console.log(`=== ${WRITE ? 'WRITE' : 'DRY-RUN'} ===`)
  console.log(
    `Matched groups: ${matched.length} (${inserts.length} members) | unmatched (no dbkpop members): ${unmatched.length}`,
  )
  console.log(
    'Matched sample:',
    matched
      .slice(0, 15)
      .map((m) => `${m.slug}(${m.n})`)
      .join(', '),
  )
  console.log('Unmatched (→ MusicBrainz/manuel plus tard):', unmatched.join(', '))

  if (!WRITE) {
    console.log('\nDry-run only. Re-run with --write to insert.')
    return
  }

  let ok = 0
  for (const m of matched) {
    const g = targets.find((t) => t.slug === m.slug)!
    const rows = inserts.filter((r) => r.group_id === g.id)
    await supabase.from('members').delete().eq('group_id', g.id)
    const { error } = await supabase.from('members').insert(rows)
    if (error) console.error(`members ${m.slug} failed:`, error.message)
    else ok += rows.length
  }
  console.log(`\nDone. Member rows inserted: ${ok} across ${matched.length} groups.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
