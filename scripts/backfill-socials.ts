// R8-B (2026-07-14) — backfill des réseaux depuis kpop.fandom :
//   - GROUPS sans Instagram (18) : infobox du groupe → {{Instagram|…}}.
//   - MEMBERS (tous) : page membre → Instagram/Twitter/TikTok/Weverse/YouTube.
// Wikitext batché (action=query&prop=revisions, 50 titres/appel) — bien moins
// de requêtes que action=parse page par page. N'écrase JAMAIS un lien existant.
//
//   npx tsx scripts/backfill-socials.ts            (dry-run)
//   npx tsx scripts/backfill-socials.ts --write
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import type { Database, Json } from '../src/types/database'

loadEnvConfig(process.cwd())
const WRITE = process.argv.includes('--write')
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

// Templates SNS fandom → clé links + URL. Handle capturé jusqu'au | ou }.
const SNS: { key: string; re: RegExp; url: (h: string) => string }[] = [
  {
    key: 'instagram',
    re: /\{\{Instagram\|([^}|]+)/i,
    url: (h) => `https://www.instagram.com/${h.trim()}/`,
  },
  { key: 'twitter', re: /\{\{Twitter\|([^}|]+)/i, url: (h) => `https://twitter.com/${h.trim()}` },
  {
    key: 'tiktok',
    re: /\{\{TikTok\|([^}|]+)/i,
    url: (h) => `https://www.tiktok.com/@${h.trim().replace(/^@/, '')}`,
  },
  { key: 'weverse', re: /\{\{Weverse\|([^}|]+)/i, url: (h) => `https://weverse.io/${h.trim()}` },
  {
    key: 'youtube',
    re: /\{\{YouTube@\|([^}|]+)/i,
    url: (h) => `https://www.youtube.com/@${h.trim()}`,
  },
]

function extractSns(wikitext: string): Record<string, string> {
  const head = wikitext.slice(0, 5000)
  const out: Record<string, string> = {}
  for (const s of SNS) {
    const m = s.re.exec(head)
    if (m && m[1].trim()) out[s.key] = s.url(m[1])
  }
  return out
}

// Batch wikitext par titres (redirects suivis). Renvoie Map<normTitre, wikitext>.
async function fetchWikitext(titles: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50)
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      redirects: '1',
      prop: 'revisions',
      rvprop: 'content',
      rvslots: 'main',
      titles: batch.join('|'),
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

async function main() {
  // ---- GROUPES sans instagram ----
  const { data: groups } = await supabase.from('groups').select('id, name, links')
  const missingIg = (groups ?? []).filter((g) => {
    const l = (g.links ?? {}) as Record<string, string>
    return !l.instagram
  })
  console.log(`Groupes sans IG : ${missingIg.length}`)
  const gTitles = [...new Set(missingIg.flatMap((g) => [g.name, titleCase(g.name)]))]
  const gWiki = await fetchWikitext(gTitles)
  let gUpdated = 0
  for (const g of missingIg) {
    const wt = gWiki.get(norm(g.name)) ?? gWiki.get(norm(titleCase(g.name)))
    if (!wt) continue
    const sns = extractSns(wt)
    if (!sns.instagram) continue
    // Existant prioritaire (sns en base d'abord, puis les liens déjà là écrasent).
    const links = { ...sns, ...((g.links ?? {}) as Record<string, string>) }
    console.log(`  ${g.name} += ${Object.keys(sns).join(',')}`)
    if (WRITE) {
      await supabase
        .from('groups')
        .update({ links: links as Json })
        .eq('id', g.id)
      gUpdated++
    }
  }

  // ---- MEMBRES ----
  const { data: members } = await supabase
    .from('members')
    .select('id, stage_name, links, groups!inner(name, is_solo)')
  const targets = (members ?? []).map((m) => {
    const g = (m as unknown as { groups: { name: string; is_solo: boolean } }).groups
    const cands = g.is_solo
      ? [m.stage_name, titleCase(m.stage_name)]
      : [
          `${m.stage_name} (${g.name})`,
          `${titleCase(m.stage_name)} (${g.name})`,
          m.stage_name,
          titleCase(m.stage_name),
          ...(m.stage_name.includes(' ')
            ? [`${titleCase(m.stage_name.split(' ').at(-1)!)} (${g.name})`]
            : []),
        ]
    return { ...m, cands: [...new Set(cands)] }
  })
  console.log(`Membres : ${targets.length}`)
  let mUpdated = 0
  for (let i = 0; i < targets.length; i += 12) {
    const batch = targets.slice(i, i + 12)
    const wiki = await fetchWikitext(batch.flatMap((t) => t.cands))
    for (const m of batch) {
      const wt = m.cands.map((c) => wiki.get(norm(c))).find(Boolean)
      if (!wt) continue
      const sns = extractSns(wt)
      if (Object.keys(sns).length === 0) continue
      const links = { ...sns, ...((m.links ?? {}) as Record<string, string>) } // existant prioritaire
      if (WRITE) {
        await supabase
          .from('members')
          .update({ links: links as Json })
          .eq('id', m.id)
        mUpdated++
      }
    }
    if ((i / 12) % 10 === 0) console.log(`  … membres ${i}/${targets.length} (maj=${mUpdated})`)
  }
  console.log(`\n${WRITE ? 'ÉCRIT' : 'DRY'} — groupes IG maj=${gUpdated}, membres maj=${mUpdated}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
