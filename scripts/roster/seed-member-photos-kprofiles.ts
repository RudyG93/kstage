/**
 * Backfill `members.photo_url` depuis kprofiles.com (fetch direct, UA navigateur
 * — Jina bloque ce domaine). Les pages « <group>-members-profile » listent, par
 * membre, une photo (filename = vrai nom) suivie de « Stage Name: X ». On apparie
 * photo↔stage name dans l'ordre du document, puis on matche au stage_name DB.
 * N'écrase jamais une photo existante. Dry-run par défaut.
 *
 *   npx tsx scripts/roster/seed-member-photos-kprofiles.ts --slugs=btob,exo
 *   npx tsx scripts/roster/seed-member-photos-kprofiles.ts --all          (groupes sans photos)
 *   ... --write                                                            (applique)
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

// Override DB slug → base kprofiles quand le nom ne suffit pas.
const KP_OVERRIDE: Record<string, string> = {
  nflying: 'n-flying',
  bts: 'bts-bangtan-boys',
  zerobaseone: 'zb1-zerobaseone',
}

// Variantes de slug kprofiles à partir du nom du groupe (+ override éventuel).
function kpCandidates(name: string, slug: string): string[] {
  const base = name
    .toLowerCase()
    .replace(/[''.!]/g, '')
    .replace(/&/g, 'and')
    .replace(/[()]/g, '')
    .trim()
    .replace(/\s+/g, '-')
  const bases = [...new Set([KP_OVERRIDE[slug], base].filter(Boolean) as string[])]
  const out: string[] = []
  for (const b of bases) {
    out.push(
      `${b}-members-profile`,
      `${b}-members-profiles`,
      `${b}-kpop-members-profile`,
      `${b}-profile-and-facts`,
      `${b}-members-profile-and-facts`,
    )
  }
  return out
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

interface Parsed {
  imgByName: { nameNorm: string; url: string }[] // nom via alt/filename (format galerie)
  orderedImgs: string[] // portraits dans l'ordre (fallback)
  stages: string[] // « Stage Name: X » dans l'ordre (fallback)
}

/** Parse les photos membres d'une page kprofiles. Deux formats gérés :
 *  (A) filename générique (IMG_xxxx-WxH) + « Stage Name: » → pairing par ordre ;
 *  (B) <img alt="Renjun" .../Renjun-11.jpg width=1440 height=1795> → match par nom.
 *  Portrait-only (H>W) pour exclure les vignettes paysage (widgets « related »). */
function parseMembers(html: string, groupName: string): Parsed {
  const $ = cheerio.load(html)
  const gNorm = norm(groupName)
  const imgByName: { nameNorm: string; url: string }[] = []
  const orderedImgs: string[] = []
  const stages: string[] = []
  $('article, .entry-content, .td-post-content, body')
    .first()
    .find('img, p, li')
    .each((_, el) => {
      if (el.tagName?.toLowerCase() === 'img') {
        const src = (
          $(el).attr('data-lazy-src') ||
          $(el).attr('data-src') ||
          $(el).attr('src') ||
          ''
        ).trim()
        if (!/\/wp-content\/uploads\//i.test(src)) return
        const file = src.split('/').pop() ?? ''
        if (/logo|herald|banner|cover|google|adsense|gravatar/i.test(file)) return
        if (norm(file).startsWith(gNorm)) return // photo de groupe
        // Portrait via dims du filename OU des attributs width/height.
        const fdim = src.match(/-(\d+)x(\d+)\.(?:jpe?g|png|webp)/i)
        const w = Number(fdim?.[1] ?? $(el).attr('width') ?? 0)
        const h = Number(fdim?.[2] ?? $(el).attr('height') ?? 0)
        if (w && h && h <= w) return // paysage → exclu
        orderedImgs.push(src)
        // Nom via alt (préféré) sinon filename (sans dims/digits/extension).
        const alt = ($(el).attr('alt') ?? '').trim()
        const fromFile = file
          .replace(/\.(jpe?g|png|webp)$/i, '')
          .replace(/-\d+x\d+$/i, '')
          .replace(/[-_]?\d+$/g, '')
        const nameNorm = norm(alt || fromFile)
        if (nameNorm.length >= 2 && nameNorm !== gNorm && !nameNorm.startsWith(gNorm))
          imgByName.push({ nameNorm, url: src })
      } else {
        const m = $(el)
          .text()
          .match(/stage name\s*:\s*([^\n(,/]+)/i)
        if (m) stages.push(m[1].trim())
      }
    })
  return { imgByName, orderedImgs, stages }
}

async function main() {
  let q = supabase.from('groups').select('id, name, slug').order('name')
  if (SLUGS.length) q = q.in('slug', SLUGS)
  const { data: groups, error } = await q
  if (error) throw error

  let totalUpdated = 0
  for (const g of groups ?? []) {
    const { data: members } = await supabase
      .from('members')
      .select('id, stage_name, photo_url')
      .eq('group_id', g.id)
    if (!members?.length) continue
    const missing = members.filter((m) => !m.photo_url)
    if (ALL && missing.length === 0) continue
    if (!SLUGS.length && !ALL) continue

    let html: string | null = null
    for (const cand of kpCandidates(g.name, g.slug)) {
      html = await fetchHtml(`https://kprofiles.com/${cand}/`)
      if (html) break
      await sleep(400)
    }
    if (!html) {
      console.log(`✖ ${g.slug.padEnd(16)} — no kprofiles page`)
      continue
    }
    const parsed = parseMembers(html, g.name)
    const usedUrl = new Set<string>()
    const usedIdx = new Set<number>()
    const sub = (a: string, b: string) => a.includes(b) || (b.length >= 3 && b.includes(a))
    // Résout l'URL d'un stage_name : 1) match par nom d'image (alt/filename),
    // 2) fallback pairing par ordre « Stage Name: » ↔ portrait. Sous-chaîne ≥3
    // pour « U-Know Yunho »↔« Yunho », « Bang Jeemin »↔« Jeemin »…
    const resolve = (stage: string): string | null => {
      const n = norm(stage)
      const e =
        parsed.imgByName.find((x) => !usedUrl.has(x.url) && x.nameNorm === n) ||
        (n.length >= 3
          ? parsed.imgByName.find((x) => !usedUrl.has(x.url) && sub(x.nameNorm, n))
          : null)
      if (e) {
        usedUrl.add(e.url)
        return e.url
      }
      let idx = parsed.stages.findIndex((s, i) => !usedIdx.has(i) && norm(s) === n)
      if (idx < 0 && n.length >= 3)
        idx = parsed.stages.findIndex((s, i) => !usedIdx.has(i) && sub(norm(s), n))
      if (idx >= 0 && idx < parsed.orderedImgs.length) {
        usedIdx.add(idx)
        return parsed.orderedImgs[idx]
      }
      return null
    }
    let updated = 0
    const unmatched: string[] = []
    for (const m of missing) {
      const url = resolve(m.stage_name)
      if (!url) {
        unmatched.push(m.stage_name)
        continue
      }
      if (WRITE) {
        const { error: uErr } = await supabase
          .from('members')
          .update({ photo_url: url })
          .eq('id', m.id)
        if (uErr) {
          console.error(`  ! ${m.stage_name}: ${uErr.message}`)
          continue
        }
      }
      updated++
    }
    totalUpdated += updated
    console.log(
      `${updated > 0 ? '✓' : '·'} ${g.slug.padEnd(16)} ${updated}/${missing.length} matched` +
        (unmatched.length ? `  (miss: ${unmatched.join(', ')})` : '') +
        `  [${parsed.orderedImgs.length} img / ${parsed.imgByName.length} named]`,
    )
    await sleep(800)
  }
  console.log(
    `\n${WRITE ? '' : '[dry-run] '}${totalUpdated} member photo(s) ${WRITE ? 'updated' : 'to update'}.`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
