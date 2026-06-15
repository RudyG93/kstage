/**
 * 2ᵉ source de comebacks ANNONCÉS (le futur) pour casser le SPOF kpopofficial
 * (BACKLOG P0.7). Source : la page Wikipedia EN « {year} in South Korean music »,
 * section « Releases », parsée depuis le **wikitext brut** (`?action=raw`) — pas
 * de HTML rendu, pas d'anti-bot, structure stable (wikitables `Date | Album |
 * Artist(s) | Ref`). Failure mode différent de kpopofficial (wiki communautaire
 * vs site unique) → redondance réelle. Scout vérifié vivant le 2026-06-15.
 *
 * La dédup cross-source d'`ingestComebacks` fait que Wikipedia ne fait que
 * COMBLER les comebacks que kpopofficial n'a pas (pas de doublon calendrier).
 *
 * Limites assumées : (1) couvre les albums/EP, pas chaque single/MV ; (2) on ne
 * prend que le 1ᵉʳ artiste d'une ligne multi-artistes (corroboration, pas
 * exhaustivité) ; (3) rollover d'année → cibler la page de l'année courante.
 */
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { kstToUtcISO } from '@/lib/events/date'
import { ingestComebacks, type GroupRef, type ParsedComeback } from './comeback-ingest'

type SupabaseClient = ReturnType<typeof createClient<Database>>

const MONTHS: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
}

export function wikitextUrl(year: number): string {
  return `https://en.wikipedia.org/wiki/${year}_in_South_Korean_music?action=raw`
}
export function pageUrl(year: number): string {
  return `https://en.wikipedia.org/wiki/${year}_in_South_Korean_music`
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Valeur d'une cellule wikitext : retire le `|` initial et d'éventuels attributs
// (`rowspan="3" |`, `style="…" |`). Les `|` internes (ex. `[[A (x)|B]]`) sont
// préservés car le séparateur d'attributs exige `nom="valeur"` avant le pipe.
function cellValue(line: string): string {
  let s = line.replace(/^\|\s*/, '')
  const m = /^((?:[a-zA-Z-]+\s*=\s*"[^"]*"\s*)+)\|\s*(.*)$/.exec(s)
  if (m) s = m[2]
  return s.trim()
}

function stripWiki(s: string): string {
  return s
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/\{\{(?:lang|nihongo)\s*\|\s*[^|}]*\|\s*([^|}]+)\}\}/gi, '$1')
    .replace(/\{\{(?:ill|interlanguage link)\s*\|\s*([^|}]+)[^}]*\}\}/gi, '$1')
    .replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, '$1')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/'''?/g, '')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Premier artiste d'une cellule (wikilink ou {{ill}}). Multi-artistes → le 1ᵉʳ.
function extractArtist(cell: string): string | null {
  const ill = /\{\{(?:ill|interlanguage link)\s*\|\s*([^|}]+)/i.exec(cell)
  if (ill) return ill[1].trim()
  const alias = /\[\[[^\]|]+\|([^\]]+)\]\]/.exec(cell)
  if (alias) return alias[1].trim()
  const link = /\[\[([^\]]+)\]\]/.exec(cell)
  if (link) return link[1].trim()
  const plain = stripWiki(cell)
  return plain || null
}

const DAY_RE = /^\d{1,2}(?:\s*[–-]\s*\d{1,2})?$/ // "5" ou range "5–6"

function parseTable(
  tableLines: string[],
  month: number,
  year: number,
  out: ParsedComeback[],
  seen: Set<string>,
) {
  // Une table de releases a un header contenant Album + Artist.
  const headerText = tableLines
    .filter((l) => l.trim().startsWith('!'))
    .join(' ')
    .toLowerCase()
  if (!headerText.includes('album') || !headerText.includes('artist')) return

  // Découpe en blocs de ligne séparés par `|-`.
  const blocks: string[][] = []
  let cur: string[] = []
  for (const line of tableLines) {
    if (/^\|-/.test(line.trim())) {
      if (cur.length) blocks.push(cur)
      cur = []
    } else {
      cur.push(line)
    }
  }
  if (cur.length) blocks.push(cur)

  let currentDay: number | null = null
  for (const block of blocks) {
    const cells = block
      .filter((l) => /^\|/.test(l.trim()) && !/^\|[-+}]/.test(l.trim()))
      .map((l) => cellValue(l.trim()))
    if (cells.length === 0) continue

    const dayCell = cells.find((c) => DAY_RE.test(c))
    if (dayCell) {
      currentDay = Number(/^\d{1,2}/.exec(dayCell)![0])
    } else if (cells.some((c) => /\{\{\s*TBA/i.test(c))) {
      currentDay = null // date inconnue explicite → pas de carry hasardeux
    }
    if (currentDay === null) continue

    const content = cells.filter(
      (c) => !DAY_RE.test(c) && !/^<ref/.test(c) && !/\{\{\s*TBA/i.test(c) && c !== '',
    )
    if (content.length < 2) continue

    const title = stripWiki(content[0])
    const artist = extractArtist(content[1])
    if (!title || !artist) continue

    const startAt = kstToUtcISO(year, month, currentDay)
    const sourceUrl = `${pageUrl(year)}#${year}-${String(month + 1).padStart(2, '0')}-${String(
      currentDay,
    ).padStart(2, '0')}_${slugify(title)}`
    if (seen.has(sourceUrl)) continue
    seen.add(sourceUrl)

    out.push({
      artist,
      title,
      sourceUrl,
      startAt,
      status: 'tentative', // jour connu, heure inconnue (comme kpopofficial sans heure)
      imageUrl: null,
    })
  }
}

/** Parse pur (testable) : wikitext → comebacks de l'année. Pas de fetch, pas de filtre futur. */
export function parseReleases(wikitext: string, year: number): ParsedComeback[] {
  const lines = wikitext.split('\n')
  const out: ParsedComeback[] = []
  const seen = new Set<string>()
  let currentMonth: number | null = null

  let i = 0
  while (i < lines.length) {
    const trimmed = lines[i].trim()
    const heading = /^=+\s*(.+?)\s*=+\s*$/.exec(trimmed)
    if (heading) {
      const mi = MONTHS[heading[1].toLowerCase()]
      currentMonth = mi === undefined ? null : mi // mois → set ; TBA/quarter/etc → null
      i++
      continue
    }
    if (/^\{\|/.test(trimmed)) {
      const table: string[] = []
      i++
      while (i < lines.length && !/^\|\}/.test(lines[i].trim())) {
        table.push(lines[i])
        i++
      }
      i++ // saute `|}`
      if (currentMonth !== null) parseTable(table, currentMonth, year, out, seen)
      continue
    }
    i++
  }
  return out
}

export interface WikipediaScrapeResult {
  parsed: number
  future: number
  matched: number
  inserted: number
  skipped: number
  pagesFetched: number
  fetchErrors: string[]
}

/** Fetch + parse + ingest (futur seulement). Symétrique de scrapeComebacks. */
export async function scrapeWikipediaReleases(
  source: { id: string },
  groups: readonly GroupRef[],
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<WikipediaScrapeResult> {
  const year = now.getUTCFullYear()
  const fetchErrors: string[] = []

  const res = await fetch(wikitextUrl(year), {
    headers: { 'user-agent': 'KStageBot/0.1 (+https://kstage.vercel.app)' },
  })
  if (!res.ok) {
    return {
      parsed: 0,
      future: 0,
      matched: 0,
      inserted: 0,
      skipped: 0,
      pagesFetched: 0,
      fetchErrors: [`${wikitextUrl(year)} → HTTP ${res.status}`],
    }
  }

  const wikitext = await res.text()
  const all = parseReleases(wikitext, year)
  // Futur seulement : le passé est couvert par le scraper YouTube (MV) ; on
  // n'inonde pas la DB des releases déjà sorties cette année.
  const nowIso = now.toISOString()
  const future = all.filter((e) => e.startAt >= nowIso)

  const r = await ingestComebacks(future, source.id, groups, supabase, { crossSourceDedupeDays: 3 })

  await supabase
    .from('sources')
    .update({ last_scraped_at: new Date().toISOString() })
    .eq('id', source.id)

  return { parsed: all.length, future: future.length, ...r, pagesFetched: 1, fetchErrors }
}
