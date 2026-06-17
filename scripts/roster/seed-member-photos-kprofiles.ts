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

// Variantes de slug kprofiles à partir du nom du groupe.
function kpCandidates(name: string): string[] {
  const base = name
    .toLowerCase()
    .replace(/[''.!]/g, '')
    .replace(/&/g, 'and')
    .replace(/[()]/g, '')
    .trim()
    .replace(/\s+/g, '-')
  return [
    `${base}-members-profile`,
    `${base}-members-profiles`,
    `${base}-profile-and-facts`,
    `${base}-members-profile-and-facts`,
  ]
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

/** Extrait des paires (stageName, photoUrl) d'une page membre kprofiles. */
function parseMembers(html: string, groupName: string): { stage: string; url: string }[] {
  const $ = cheerio.load(html)
  const gNorm = norm(groupName)
  const imgs: string[] = []
  const stages: string[] = []
  // Parcours en ordre du document : on collecte photos membres + « Stage Name ».
  $('article, .entry-content, .td-post-content, body')
    .first()
    .find('img, p, li')
    .each((_, el) => {
      const tag = el.tagName?.toLowerCase()
      if (tag === 'img') {
        const src = ($(el).attr('data-src') || $(el).attr('src') || '').trim()
        const file = src.split('/').pop() ?? ''
        // photo membre = upload avec dimensions WxH, hors logo/banner/nom-de-groupe
        if (
          /\/wp-content\/uploads\/.+-\d+x\d+\.(jpe?g|png|webp)/i.test(src) &&
          !/logo|herald|banner|cover|google|adsense/i.test(file) &&
          !norm(file).startsWith(gNorm)
        ) {
          imgs.push(src) // garde la version dimensionnée (≈640x800, légère, qualité OK)
        }
      } else {
        const t = $(el).text()
        const m = t.match(/stage name\s*:\s*([^\n(,/]+)/i)
        if (m) stages.push(m[1].trim())
      }
    })
  const n = Math.min(imgs.length, stages.length)
  const out: { stage: string; url: string }[] = []
  for (let i = 0; i < n; i++) out.push({ stage: stages[i], url: imgs[i] })
  return out
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
    let usedUrl = ''
    for (const cand of kpCandidates(g.name)) {
      usedUrl = `https://kprofiles.com/${cand}/`
      html = await fetchHtml(usedUrl)
      if (html) break
      await sleep(400)
    }
    if (!html) {
      console.log(`✖ ${g.slug.padEnd(16)} — no kprofiles page`)
      continue
    }
    const pairs = parseMembers(html, g.name)
    const byNorm = new Map(pairs.map((p) => [norm(p.stage), p.url]))
    let updated = 0
    const unmatched: string[] = []
    for (const m of missing) {
      const url = byNorm.get(norm(m.stage_name))
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
        `  [${pairs.length} on page]`,
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
