/**
 * Détecte les ANCIENS membres via kprofiles (section « Former Member: ») et les
 * note en base : membre existant → status='former' ; absent → insertion en
 * status='former' avec photo. PAS de birthday (les anciens membres ne doivent
 * pas générer d'anniversaires). Dry-run par défaut.
 *
 *   npx tsx scripts/roster/seed-former-members-kprofiles.ts --slugs=monstax,oneus
 *   npx tsx scripts/roster/seed-former-members-kprofiles.ts --all --write
 *
 * ⚠️ NE PAS faire confiance à `--all --write` aveuglément : certaines pages
 * kprofiles mettent un sondage/note APRÈS la section « Former Member: » →
 * sur-capture des membres ACTUELS comme anciens (faux positifs vus : fromis9
 * Jisun/Seoyeon, nct127 Mark, zerobaseone Ricky). Toujours faire un dry-run,
 * vérifier chaque détection, puis appliquer par `--slugs` sur les groupes sûrs.
 * Le format « name-only » (sans bloc « Stage Name: ») n'est PAS détecté (ex.
 * Wonho/MONSTA X) → compléter à la main les cas notables manquants.
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import * as cheerio from 'cheerio'
import type { Database } from '../../src/types/database'

loadEnvConfig(process.cwd())
const WRITE = process.argv.includes('--write')
const ALL = process.argv.includes('--all')
const SLUGS = (process.argv.find((a) => a.startsWith('--slugs='))?.slice(8) ?? '')
  .split(',')
  .filter(Boolean)
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const KP_OVERRIDE: Record<string, string> = { nflying: 'n-flying', bts: 'bts-bangtan-boys' }
function kpCandidates(name: string, slug: string): string[] {
  const base = name
    .toLowerCase()
    .replace(/[''.!]/g, '')
    .replace(/&/g, 'and')
    .replace(/[()]/g, '')
    .trim()
    .replace(/\s+/g, '-')
  const bases = [...new Set([KP_OVERRIDE[slug], base].filter(Boolean) as string[])]
  return bases.flatMap((b) => [
    `${b}-members-profile`,
    `${b}-members-profiles`,
    `${b}-profile-and-facts`,
  ])
}
async function fetchHtml(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA } })
    if (!r.ok) return null
    const html = await r.text()
    return /stage name\s*:/i.test(html) ? html : null
  } catch {
    return null
  }
}

/** Parse current vs former : la frontière = un heading « Former Member(s) ». */
function parse(
  html: string,
  groupName: string,
): { former: { stage: string; url: string | null }[] } {
  const $ = cheerio.load(html)
  const gNorm = norm(groupName)
  type Tok = { kind: 'img' | 'stage' | 'former'; val?: string }
  const toks: Tok[] = []
  $('article, .entry-content, .td-post-content, body')
    .first()
    .find('img, p, li, h2, h3, h4, strong, b')
    .each((_, el) => {
      const tag = el.tagName?.toLowerCase()
      if (tag === 'img') {
        const src = (
          $(el).attr('data-lazy-src') ||
          $(el).attr('data-src') ||
          $(el).attr('src') ||
          ''
        ).trim()
        const file = src.split('/').pop() ?? ''
        if (
          /\/wp-content\/uploads\/.+-\d+x\d+\.(jpe?g|png|webp)/i.test(src) &&
          !/logo|herald|banner|cover|google|adsense/i.test(file) &&
          !norm(file).startsWith(gNorm)
        )
          toks.push({ kind: 'img', val: src })
        return
      }
      const t = $(el).text().trim()
      if (/^former members?\b/i.test(t) && t.length < 60) toks.push({ kind: 'former' })
      const m = t.match(/stage name\s*:\s*([^\n(,/]+)/i)
      if (m) toks.push({ kind: 'stage', val: m[1].trim() })
    })
  let inFormer = false
  let lastImg: string | null = null
  const former: { stage: string; url: string | null }[] = []
  for (const tk of toks) {
    if (tk.kind === 'former') inFormer = true
    else if (tk.kind === 'img') lastImg = tk.val ?? null
    else if (tk.kind === 'stage') {
      if (inFormer && tk.val) former.push({ stage: tk.val, url: lastImg })
      lastImg = null
    }
  }
  return { former }
}

async function main() {
  let q = supabase.from('groups').select('id, name, slug').eq('is_solo', false).order('name')
  if (SLUGS.length) q = q.in('slug', SLUGS)
  const { data: groups, error } = await q
  if (error) throw error

  let marked = 0
  let inserted = 0
  for (const g of groups ?? []) {
    if (!SLUGS.length && !ALL) continue
    let html: string | null = null
    for (const cand of kpCandidates(g.name, g.slug)) {
      html = await fetchHtml(`https://kprofiles.com/${cand}/`)
      if (html) break
      await sleep(300)
    }
    if (!html) continue
    const { former } = parse(html, g.name)
    if (former.length === 0) continue

    const { data: members } = await supabase
      .from('members')
      .select('id, stage_name, status')
      .eq('group_id', g.id)
    const byNorm = new Map((members ?? []).map((m) => [norm(m.stage_name), m]))
    const acts: string[] = []
    for (const f of former) {
      const existing = byNorm.get(norm(f.stage))
      if (existing) {
        if (existing.status !== 'former') {
          acts.push(`mark ${f.stage}`)
          if (WRITE)
            await supabase.from('members').update({ status: 'former' }).eq('id', existing.id)
          marked++
        }
      } else {
        acts.push(`+${f.stage}`)
        if (WRITE)
          await supabase
            .from('members')
            .insert({ group_id: g.id, stage_name: f.stage, status: 'former', photo_url: f.url })
        inserted++
      }
    }
    if (acts.length) console.log(`${g.slug.padEnd(16)} ${acts.join(', ')}`)
    await sleep(700)
  }
  console.log(`\n${WRITE ? '' : '[dry-run] '}${marked} marked former, ${inserted} inserted.`)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
