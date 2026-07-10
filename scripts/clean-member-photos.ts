/**
 * Nettoyage des photos membres erronées (audit prod 2026-07-10) + re-dérivation
 * stricte depuis kprofiles. À lancer AVANT scripts/selfhost-member-photos.ts,
 * sinon le self-host figerait les mauvaises images dans le Storage.
 *
 * Phase 1 — NULL-ification d'une liste REVUE À LA MAIN (14 rows) :
 *   - graphiques « calendrier du mois » kprofiles servis comme portraits
 *     (June-2026-300x168.png sur RM/Jin Jin/Renjun/Kwangjin, etc.) ;
 *   - photo d'un AUTRE membre (astro:MJ → Ong Seongwu ; onf:Wyatt → MK ;
 *     ftisland:Jonghun → Seunghyun ; zerobaseone:Ricky → Hanbin) ;
 *   - clusters au filename anonyme impossibles à trancher (treasure ×4).
 *   Partages LÉGITIMES conservés (même personne, fiches liées par canonical_id) :
 *   idle/soojin Soojin, illit/alldayproject Youngseo.
 *
 * Phase 2 — re-dérivation kprofiles, format GALERIE uniquement (alt/filename
 * nommé = membre), avec garde-fous stricts. Le « pairing par ordre » du script
 * d'origine (scripts/roster/seed-member-photos-kprofiles.ts) est volontairement
 * ABSENT : c'est lui qui produisait les décalages. Un membre sans match strict
 * reste NULL → fallback UI initiale+dégradé (jamais une photo fausse).
 *
 *   npx tsx scripts/clean-member-photos.ts            (dry-run)
 *   npx tsx scripts/clean-member-photos.ts --write    (applique)
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import * as cheerio from 'cheerio'
import type { Database } from '../src/types/database'

loadEnvConfig(process.cwd())
const WRITE = process.argv.includes('--write')
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Graphiques « comebacks du mois » kprofiles (jamais un portrait).
const CALENDAR_RE =
  /(january|february|march|april|may|june|july|august|september|october|november|december)-?20\d{2}-\d+x\d+\.(png|jpe?g|webp)/i

// ---------- Phase 1 : liste revue (group_slug, stage_name, raison) ----------

const TO_NULL: { group: string; member: string; reason: string }[] = [
  { group: 'ace', member: 'Chan', reason: 'calendrier March-2026' },
  { group: 'astro', member: 'Eunwoo', reason: 'calendrier May-2026' },
  { group: 'astro', member: 'Jin Jin', reason: 'calendrier June-2026' },
  { group: 'astro', member: 'MJ', reason: 'photo de Ong Seongwu (SEONGWU-300x168)' },
  { group: 'bts', member: 'RM', reason: 'calendrier June-2026' },
  { group: 'nctdream', member: 'Renjun', reason: 'calendrier June-2026' },
  { group: 'nflying', member: 'Kwangjin', reason: 'calendrier June-2026' },
  { group: 'ftisland', member: 'Jonghun', reason: 'photo de Seunghyun (3-Seunghyun)' },
  { group: 'onf', member: 'Wyatt', reason: 'photo de MK (MINKYUN-1)' },
  { group: 'zerobaseone', member: 'Ricky', reason: 'photo de Hanbin (SUNG-HANBIN-1)' },
  { group: 'treasure', member: 'Hyunsuk', reason: 'IMG_4120 partagé avec Junkyu, indécidable' },
  { group: 'treasure', member: 'Junkyu', reason: 'IMG_4120 partagé avec Hyunsuk, indécidable' },
  { group: 'treasure', member: 'Jaehyuk', reason: 'IMG_4121 partagé avec Yoshi, indécidable' },
  { group: 'treasure', member: 'Yoshi', reason: 'IMG_4121 partagé avec Jaehyuk, indécidable' },
]

// Groupes à re-dériver (ceux touchés par la phase 1).
const REDERIVE_SLUGS = [...new Set(TO_NULL.map((t) => t.group))]

// Slug DB → base kprofiles (repris du script d'origine).
const KP_OVERRIDE: Record<string, string> = {
  nflying: 'n-flying',
  bts: 'bts-bangtan-boys',
  zerobaseone: 'zb1-zerobaseone',
}

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

/** Portraits nommés de la page (format galerie STRICT : alt ou filename = nom). */
function parseNamedPortraits(html: string, groupName: string): { nameNorm: string; url: string }[] {
  const $ = cheerio.load(html)
  const gNorm = norm(groupName)
  const out: { nameNorm: string; url: string }[] = []
  $('article, .entry-content, .td-post-content, body')
    .first()
    .find('img')
    .each((_, el) => {
      const src = (
        $(el).attr('data-lazy-src') ||
        $(el).attr('data-src') ||
        $(el).attr('src') ||
        ''
      ).trim()
      if (!/\/wp-content\/uploads\//i.test(src)) return
      const file = src.split('/').pop() ?? ''
      if (/logo|herald|banner|cover|google|adsense|gravatar/i.test(file)) return
      if (CALENDAR_RE.test(file)) return
      if (norm(file).startsWith(gNorm)) return // photo de groupe
      // Portrait ou carré uniquement (le paysage = vignettes widgets/related).
      const fdim = src.match(/-(\d+)x(\d+)\.(?:jpe?g|png|webp)/i)
      const w = Number(fdim?.[1] ?? $(el).attr('width') ?? 0)
      const h = Number(fdim?.[2] ?? $(el).attr('height') ?? 0)
      if (w && h && h < w) return
      const alt = ($(el).attr('alt') ?? '')
        .replace(/\s+of\s+.+$/i, '')
        .replace(/\(.*?\)/g, '')
        .trim()
      const fromFile = file
        .replace(/\.(jpe?g|png|webp)$/i, '')
        .replace(/-\d+x\d+$/i, '')
        .replace(/[-_]?\d+$/g, '')
        .replace(/[-_]/g, ' ')
      for (const cand of [alt, fromFile]) {
        const nameNorm = norm(cand)
        if (nameNorm.length >= 2 && nameNorm !== gNorm && !nameNorm.startsWith(gNorm))
          out.push({ nameNorm, url: src })
      }
    })
  return out
}

async function isServableImage(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': UA } })
    return r.ok && (r.headers.get('content-type') ?? '').startsWith('image/')
  } catch {
    return false
  }
}

async function main() {
  // ---------- Phase 1 : NULL-ification ----------
  const { data: groups, error: gErr } = await supabase
    .from('groups')
    .select('id, slug, name')
    .in('slug', REDERIVE_SLUGS)
  if (gErr) throw gErr
  const bySlug = new Map((groups ?? []).map((g) => [g.slug, g]))

  let nulled = 0
  for (const t of TO_NULL) {
    const g = bySlug.get(t.group)
    if (!g) {
      console.log(`✖ groupe introuvable: ${t.group}`)
      continue
    }
    const { data: m } = await supabase
      .from('members')
      .select('id, photo_url')
      .eq('group_id', g.id)
      .eq('stage_name', t.member)
      .maybeSingle()
    if (!m) {
      console.log(`✖ membre introuvable: ${t.group}/${t.member}`)
      continue
    }
    if (!m.photo_url) {
      console.log(`· déjà NULL: ${t.group}/${t.member}`)
      continue
    }
    console.log(`${WRITE ? 'NULL' : '[dry] NULL'} ${t.group}/${t.member} — ${t.reason}`)
    if (WRITE) {
      const { error } = await supabase.from('members').update({ photo_url: null }).eq('id', m.id)
      if (error) throw error
    }
    nulled++
  }

  // ---------- Phase 2 : re-dérivation stricte ----------
  // Toutes les URLs déjà en DB : une photo re-dérivée ne doit JAMAIS être
  // déjà utilisée par un autre membre (c'est le bug qu'on nettoie).
  const { data: allMembers } = await supabase
    .from('members')
    .select('id, group_id, stage_name, real_name, photo_url')
  const usedUrls = new Set((allMembers ?? []).map((m) => m.photo_url).filter(Boolean) as string[])

  let derived = 0
  for (const slug of REDERIVE_SLUGS) {
    const g = bySlug.get(slug)
    if (!g) continue
    const targets = (allMembers ?? []).filter(
      (m) =>
        m.group_id === g.id &&
        (m.photo_url === null ||
          TO_NULL.some((t) => t.group === slug && t.member === m.stage_name)),
    )
    if (targets.length === 0) continue

    let html: string | null = null
    for (const cand of kpCandidates(g.name, slug)) {
      html = await fetchHtml(`https://kprofiles.com/${cand}/`)
      if (html) break
      await sleep(400)
    }
    if (!html) {
      console.log(`✖ ${slug} — pas de page kprofiles exploitable`)
      continue
    }
    const portraits = parseNamedPortraits(html, g.name)

    for (const m of targets) {
      // Match STRICT uniquement : nameNorm === stage_name ou real_name normalisé.
      const names = [norm(m.stage_name), m.real_name ? norm(m.real_name) : ''].filter(
        (s) => s.length >= 2,
      )
      const hit = portraits.find((p) => names.includes(p.nameNorm) && !usedUrls.has(p.url))
      if (!hit) {
        console.log(`· pas de match strict: ${slug}/${m.stage_name} → reste NULL`)
        continue
      }
      if (!(await isServableImage(hit.url))) {
        console.log(`· image non servable: ${slug}/${m.stage_name} → ${hit.url}`)
        continue
      }
      console.log(`${WRITE ? 'SET ' : '[dry] SET '} ${slug}/${m.stage_name} → ${hit.url}`)
      usedUrls.add(hit.url)
      if (WRITE) {
        const { error } = await supabase
          .from('members')
          .update({ photo_url: hit.url })
          .eq('id', m.id)
        if (error) throw error
      }
      derived++
      await sleep(150)
    }
    await sleep(500)
  }

  console.log(`\nRésumé: ${nulled} photo(s) nullifiée(s), ${derived} re-dérivée(s) strictement.`)
  if (!WRITE) console.log('Dry-run — relance avec --write pour appliquer.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
