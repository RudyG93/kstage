// R8.1 — scan de la classe « réseaux du mauvais homonyme » sur les solistes.
// Lisa (BLACKPINK) avait tout le bloc de LiSA (JP) car seed-artist-links cherchait
// MusicBrainz par nom court (limit=5) → homonyme mondial. Ce scan re-dérive
// l'Instagram depuis l'infobox fandom DÉSAMBIGUÏSÉE (Lisa → « Lisa (BLACKPINK) »,
// pas le nom nu qui tombe sur une page {{Disambig}}) et le DIFFE contre le stocké.
// Le parent d'un soliste est trouvé via sa row membre dans un groupe non-solo.
//
//   npx tsx scripts/scan-soloist-socials.ts
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database'

loadEnvConfig(process.cwd())
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36'
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '')
const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
const igHandle = (u?: string) =>
  u ? norm(u.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').split(/[/?]/)[0]) : ''

async function fetchWikitext(titles: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  for (let i = 0; i < titles.length; i += 50) {
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      redirects: '1',
      prop: 'revisions',
      rvprop: 'content',
      rvslots: 'main',
      titles: titles.slice(i, i + 50).join('|'),
    })
    const res = await fetch(`https://kpop.fandom.com/api.php?${params}`, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    })
    if (!res.ok) continue
    const data = (await res.json()) as {
      query?: {
        pages?: Record<
          string,
          { title?: string; revisions?: { slots?: { main?: { '*'?: string } } }[] }
        >
      }
    }
    for (const p of Object.values(data.query?.pages ?? {})) {
      const wt = p.revisions?.[0]?.slots?.main?.['*']
      if (p.title && wt) map.set(norm(p.title), wt)
    }
    await new Promise((r) => setTimeout(r, 120))
  }
  return map
}

function fandomIg(wikitext: string): string | undefined {
  const m = /\{\{Instagram\|([^}|]+)/i.exec(wikitext.slice(0, 5000))
  return m?.[1]?.trim()
}

async function main() {
  const { data: solos } = await supabase
    .from('groups')
    .select('id, name, slug, links')
    .eq('is_solo', true)
  // Parent(s) de chaque soliste : ses rows membre dans un groupe NON-solo.
  const { data: memberships } = await supabase
    .from('members')
    .select('stage_name, groups!inner(name, is_solo)')
    .limit(3000)
  const parents = new Map<string, string[]>()
  for (const m of memberships ?? []) {
    if (m.groups.is_solo) continue
    const k = norm(m.stage_name)
    parents.set(k, [...(parents.get(k) ?? []), m.groups.name])
  }

  const rows = (solos ?? []).map((g) => {
    const ps = parents.get(norm(g.name)) ?? []
    const cands = [
      // Variante upper du qualificateur : le wiki écrit « (BLACKPINK) »,
      // « (MAMAMOO) » alors que la DB stocke « Blackpink »/« Mamamoo »
      // (MediaWiki sensible à la casse après la 1re lettre).
      ...ps.flatMap((p) => [`${g.name} (${p})`, `${g.name} (${p.toUpperCase()})`]),
      `${g.name} (singer)`,
      g.name,
      titleCase(g.name),
    ]
    return { ...g, cands: [...new Set(cands)] }
  })

  const wiki = await fetchWikitext([...new Set(rows.flatMap((r) => r.cands))])

  console.log(`\n=== Scan réseaux solistes (${rows.length}) ===`)
  const flags: string[] = []
  for (const r of rows) {
    const links = (r.links ?? {}) as Record<string, string>
    const stored = igHandle(links.instagram)
    // Meilleur candidat fandom AVEC un Instagram.
    let fan: string | undefined
    for (const c of r.cands) {
      const wt = wiki.get(norm(c))
      if (wt) {
        const ig = fandomIg(wt)
        if (ig) {
          fan = norm(ig)
          break
        }
      }
    }
    let verdict: string
    if (!stored && !fan) verdict = 'ø   (ni stocké ni fandom)'
    else if (!stored && fan) verdict = `+   fandom=${fan} (stocké vide → backfill)`
    else if (stored && !fan) verdict = `?   stocké=${stored} (pas d'infobox fandom)`
    else if (stored === fan) verdict = `ok  ${stored}`
    else {
      verdict = `MISMATCH stocké=${stored} ≠ fandom=${fan}`
      flags.push(`${r.slug}: ${stored} → ${fan}`)
    }
    console.log(`  ${r.slug.padEnd(14)} ${verdict}`)
  }
  console.log(`\n⚠️  MISMATCHES (${flags.length}) :`)
  for (const f of flags) console.log(`   ${f}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
