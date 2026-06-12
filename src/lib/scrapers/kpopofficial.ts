import * as cheerio from 'cheerio'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { kstToUtcISO } from '@/lib/events/date'

type EventStatus = Database['public']['Enums']['event_status']
type SupabaseClient = ReturnType<typeof createClient<Database>>

export interface GroupRef {
  id: string
  slug: string
  name: string
}

export interface ParsedComeback {
  artist: string
  title: string
  sourceUrl: string
  startAt: string // UTC ISO
  status: EventStatus
  imageUrl: string | null
}

interface ScrapeResult {
  matched: number
  inserted: number
  skipped: number
}

const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
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

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

// Variantes normalisées non couvertes par la normalisation simple.
// "G-IDLE" / "GIDLE" / "(G)I-DLE" normalisent tous en "gidle" → on les mappe
// vers le slug actuel `idle`. "I-DLE" normalise en "idle" et matche déjà
// directement le slug, donc pas besoin d'entrée pour lui.
const GROUP_ALIASES: Record<string, string> = {
  gidle: 'idle',
}

/** Matche un nom d'artiste scrapé vers un de nos groupes suivis, sinon null. */
export function matchGroup(artist: string, groups: readonly GroupRef[]): GroupRef | null {
  const key = normalize(artist)
  if (!key) return null
  for (const g of groups) {
    if (normalize(g.name) === key || normalize(g.slug) === key) return g
  }
  const aliasSlug = GROUP_ALIASES[key]
  if (aliasSlug) return groups.find((g) => g.slug === aliasSlug) ?? null
  return null
}

// Le span artiste : ni mois, ni nombre (jour/vues), ni date KST, ni ligne "type – nom" / "Title – ...".
function pickArtist(metas: readonly string[]): string | null {
  for (const m of metas) {
    if (!m) continue
    if (/kst/i.test(m)) continue
    if (/^\d[\d,]*$/.test(m)) continue
    if (/–\s|^\s*title/i.test(m)) continue
    if (m.toLowerCase() in MONTHS) continue
    return m
  }
  return null
}

// La ligne date commence par un nom de mois connu + un jour (avec ou sans heure KST).
function pickDateMeta(metas: readonly string[]): string | null {
  return (
    metas.find((m) => {
      const w = /^([A-Za-z]+)\s+\d{1,2}\b/.exec(m)
      return w !== null && w[1].toLowerCase() in MONTHS
    }) ?? null
  )
}

function titleYear(title: string): number | null {
  const m = /\((\d{4})\)\s*$/.exec(title)
  return m ? Number(m[1]) : null
}

// "May 4 (Mon) · 6 PM KST" → { startAt, status }. Heure absente → tentative.
function parseDate(
  dateMeta: string,
  year: number,
): { startAt: string; status: EventStatus } | null {
  const d = /^\s*([A-Za-z]+)\s+(\d{1,2})/.exec(dateMeta)
  if (!d) return null
  const monthIndex = MONTHS[d[1].toLowerCase()]
  if (monthIndex === undefined) return null
  const day = Number(d[2])

  const t = /·\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*KST/i.exec(dateMeta)
  if (!t) return { startAt: kstToUtcISO(year, monthIndex, day), status: 'tentative' }

  let hour = Number(t[1])
  const minute = t[2] ? Number(t[2]) : 0
  const pm = /pm/i.test(t[3])
  if (pm && hour !== 12) hour += 12
  if (!pm && hour === 12) hour = 0
  return { startAt: kstToUtcISO(year, monthIndex, day, hour, minute), status: 'confirmed' }
}

/** Parse pur d'une page mensuelle kpopofficial. Tolérant : ignore les entrées incomplètes. */
export function parseComebacks(html: string, fallbackYear: number): ParsedComeback[] {
  const $ = cheerio.load(html)
  const out: ParsedComeback[] = []
  const seen = new Set<string>()

  for (const li of $('li.gspbgrid_item').toArray()) {
    const link = $(li).find('a.gspbgrid_item_link').first()
    const title = link.attr('title')?.trim()
    const sourceUrl = link.attr('href')?.trim()
    if (!title || !sourceUrl || seen.has(sourceUrl)) continue

    const metas = $(li)
      .find('span.gspb_meta_value')
      .toArray()
      .map((s) => $(s).text().trim())

    const artist = pickArtist(metas)
    const dateMeta = pickDateMeta(metas)
    if (!artist || !dateMeta) continue

    const parsed = parseDate(dateMeta, titleYear(title) ?? fallbackYear)
    if (!parsed) {
      console.warn(`kpopofficial: date illisible pour "${title}": "${dateMeta}"`)
      continue
    }

    const img = $(li).find('img').first()
    const imageUrl = img.attr('data-orig-file') || img.attr('src') || null

    seen.add(sourceUrl)
    out.push({ artist, title, sourceUrl, startAt: parsed.startAt, status: parsed.status, imageUrl })
  }

  return out
}

// Pages à scraper : mois courant + mois suivant (le mois suivant peut ne pas exister encore → 404 ignoré).
function monthPages(now: Date): { url: string; year: number }[] {
  return [0, 1].map((offset) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1))
    const year = d.getUTCFullYear()
    const slug = MONTH_SLUGS[d.getUTCMonth()]
    return { url: `https://kpopofficial.com/kpop-comeback-schedule-${slug}-${year}/`, year }
  })
}

export async function scrapeComebacks(
  source: { id: string },
  groups: readonly GroupRef[],
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<ScrapeResult> {
  let matched = 0
  let inserted = 0
  let skipped = 0

  for (const page of monthPages(now)) {
    const res = await fetch(page.url, {
      headers: { 'user-agent': 'KStageBot/0.1 (+https://kstage.vercel.app)' },
    })
    if (!res.ok) continue

    const html = await res.text()
    for (const cb of parseComebacks(html, page.year)) {
      const group = matchGroup(cb.artist, groups)
      if (!group) continue
      matched++

      const { data: existing } = await supabase
        .from('events')
        .select('id')
        .eq('source_url', cb.sourceUrl)
        .maybeSingle()

      if (existing) {
        skipped++
        continue
      }

      const { error } = await supabase.from('events').insert({
        group_id: group.id,
        source_id: source.id,
        source_url: cb.sourceUrl,
        // Taxonomie (décision 2026-05-27, réaffirmée à l'audit 2026-06-12) :
        // MV = clip vidéo (embed YouTube + page /mv), Release = sortie datée
        // d'album/single. Une annonce kpopofficial est une sortie datée SANS
        // vidéo → 'release'. Le clip arrivera via le scraper YouTube ('mv').
        type: 'release',
        title: cb.title,
        start_at: cb.startAt,
        status: cb.status,
        image_url: cb.imageUrl,
      })

      if (error) {
        console.error(`Insert failed for ${cb.sourceUrl}:`, error.message)
        skipped++
      } else {
        inserted++
      }
    }
  }

  await supabase
    .from('sources')
    .update({ last_scraped_at: new Date().toISOString() })
    .eq('id', source.id)

  return { matched, inserted, skipped }
}
