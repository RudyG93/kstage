// Diagnostic P0.5 : quels artistes du calendrier kpopofficial ne matchent
// AUCUN groupe en DB ? (comebacks annoncés qu'on jette silencieusement)
// Usage : npx tsx scripts/diagnose-kpopofficial-matching.ts
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { parseComebacks, matchGroups, type GroupRef } from '../src/lib/scrapers/kpopofficial'

function envLocal(key: string): string {
  const line = readFileSync('.env.local', 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`${key}=`))
  if (!line) throw new Error(`${key} absent de .env.local`)
  return line
    .slice(key.length + 1)
    .replace(/^"|"$/g, '')
    .trim()
}

const MONTH_SLUGS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
]

async function main() {
  const supabase = createClient(
    envLocal('NEXT_PUBLIC_SUPABASE_URL'),
    envLocal('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  )
  const { data: groups, error } = await supabase.from('groups').select('id, slug, name')
  if (error) throw error
  const refs = (groups ?? []) as GroupRef[]
  console.log(`${refs.length} groupes en DB`)

  const now = new Date()
  for (const offset of [0, 1]) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1))
    const url = `https://kpopofficial.com/kpop-comeback-schedule-${MONTH_SLUGS[d.getUTCMonth()]}-${d.getUTCFullYear()}/`
    const res = await fetch(url, {
      headers: { 'user-agent': 'KStageBot/0.1 (+https://kstage.vercel.app)' },
    })
    console.log(`\n=== ${url} → HTTP ${res.status}`)
    if (!res.ok) continue
    const entries = parseComebacks(await res.text(), d.getUTCFullYear())
    const unmatched = new Map<string, string[]>()
    let matched = 0
    for (const cb of entries) {
      const groups = matchGroups(cb.artist, refs)
      if (groups.length > 0) {
        matched += groups.length
      } else {
        const list = unmatched.get(cb.artist) ?? []
        list.push(`${cb.startAt.slice(0, 10)} ${cb.title}`)
        unmatched.set(cb.artist, list)
      }
    }
    console.log(
      `${entries.length} entrées, ${matched} matchées, ${unmatched.size} artistes non matchés :`,
    )
    for (const [artist, items] of [...unmatched.entries()].sort()) {
      console.log(`  - ${artist} → ${items.join(' | ')}`)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
