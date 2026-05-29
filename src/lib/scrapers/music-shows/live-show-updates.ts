/**
 * Scraper du fan-aggregator `liveshowupdatess.carrd.co` : couvre les 6 music
 * shows hebdo k-pop (The Show, Show Champion, M Countdown, Music Bank, Music
 * Core, Inkigayo) en une seule fetch. Le contenu est rendu via le proxy
 * `r.jina.ai` (bypasse les anti-bots + extrait le markdown rendu).
 *
 * Format observé (fixture 2026-05-29) :
 *   ## ✧*̥˚ {SHOW NAME}{punctuation} *̥˚✧
 *   ...
 *   ### Episode: NNN
 *   <meta line with time + date + MCs ; ordre/format légèrement différent par show>
 *   **Line up**   (ou variante avec emphasis)
 *
 *    Artist1 / Artist2 / Artist3 / …
 *
 * Parser tolérant aux variations (whitespace, emphasis Markdown, ordre des
 * champs, lineups multi-paragraphe pour Inkigayo).
 */

export const SOURCE_URL = 'https://liveshowupdatess.carrd.co/'
const JINA_URL = `https://r.jina.ai/${SOURCE_URL}`

export type ShowId =
  | 'the-show'
  | 'show-champion'
  | 'm-countdown'
  | 'music-bank'
  | 'music-core'
  | 'inkigayo'

export interface ShowDefinition {
  id: ShowId
  displayName: string
  // Mot-clé qui identifie de manière unique le header de section de ce show.
  headerMarker: RegExp
}

export const SHOWS: ShowDefinition[] = [
  // Ordre = ordre du fichier source. Le check `SHOW CHAMPION` doit passer avant
  // `THE SHOW` car le second matche le premier en substring lâche.
  { id: 'show-champion', displayName: 'Show Champion', headerMarker: /SHOW CHAMPION/i },
  {
    id: 'm-countdown',
    displayName: 'M Countdown',
    headerMarker: /M Countdown|MCountdown|Mnet.*Countdown/i,
  },
  { id: 'music-bank', displayName: 'Music Bank', headerMarker: /Music Bank/i },
  { id: 'music-core', displayName: 'Music Core', headerMarker: /Music Core/i },
  { id: 'inkigayo', displayName: 'Inkigayo', headerMarker: /INKIGAYO/i },
  { id: 'the-show', displayName: 'The Show', headerMarker: /THE SHOW/i },
]

export interface RawLineup {
  show: ShowId
  episodeNumber: number
  monthDay: string // "MM/DD"
  time12h: string // ex "6:00pm", "4:57pm"
  isHighlight: boolean // true si "highlight broadcast with previous stages"
  artistsRaw: string[] // bruts, à passer à extractCanonicalName côté caller
}

export interface ParsedLineup extends RawLineup {
  startAtIso: string // UTC ISO 8601, déduit de monthDay + time12h + année inférée
}

/**
 * Découpe le markdown carrd en blocs de section (un par show) en se basant sur
 * le header `## ✧*̥˚ {NAME} *̥˚✧`. Les sections de la zone "Show Times & Lineup
 * Info" (early sections, sans Episode) sont ignorées via la présence du marker
 * `Episode:` qui n'apparaît que dans les blocs de lineup.
 */
function splitSections(markdown: string): string[] {
  // Header de section : ligne commençant par `## ` qui contient `✧` et un nom de show.
  const lines = markdown.split('\n')
  const sections: string[] = []
  let current: string[] | null = null
  for (const line of lines) {
    if (/^##\s+✧.+✧\s*$/.test(line)) {
      if (current) sections.push(current.join('\n'))
      current = [line]
    } else if (current) {
      current.push(line)
    }
  }
  if (current) sections.push(current.join('\n'))
  // Garder seulement les sections qui ont au moins une ligne "Episode:".
  return sections.filter((s) => /Episode:\s*\d+/i.test(s))
}

function detectShow(section: string): ShowId | null {
  // On lit le header (1ʳᵉ ligne) pour matcher le bon show.
  const headerLine = section.split('\n', 1)[0] ?? ''
  for (const def of SHOWS) {
    if (def.headerMarker.test(headerLine)) return def.id
  }
  return null
}

function parseEpisodeNumber(section: string): number | null {
  const m = section.match(/Episode:\s*(\d+)/i)
  return m ? Number(m[1]) : null
}

/**
 * Extrait `MM/DD` + `H:MMpm` (ou `am`) où qu'ils soient dans la section.
 * La carrd publie le marker `MM/DD` derrière `||` et le time juste avant.
 *   Exemples observés :
 *     "6:00pm KST || 06/02 MCs: ~"
 *     "5:00 pm KST || 05/27 MCs: ..."
 *     "# MCs: ... 6:00pm KST || 05/28"
 *     "New MCs: ... 4:57pm KST || 05/29"
 *     "3:25pm KST* || 05/31"
 */
function parseTimeAndDate(section: string): { time12h: string; monthDay: string } | null {
  // Tolère espaces variables et un éventuel astérisque après KST.
  const re = /(\d{1,2}:\d{2}\s*(?:am|pm))\s*KST\*?\s*\|\|\s*(\d{1,2}\/\d{1,2})/i
  const m = section.match(re)
  if (!m) return null
  return {
    time12h: m[1].replace(/\s+/g, '').toLowerCase(),
    monthDay: m[2],
  }
}

function isHighlightBroadcast(section: string): boolean {
  return /highlight\s+broadcast/i.test(section)
}

/**
 * Extrait la ligne de lineup. La structure est :
 *   **Line up** (ou variantes Markdown)
 *
 *   Artist1 / Artist2 / …
 *
 * Pour Show Champion en highlight, le marker est différent
 *   `**The weeks episode is a highlight broadcast** with previous stages from:`
 *   suivi du même format de slash list.
 *
 * Pour Inkigayo, le lineup peut s'étaler sur 2 paragraphes (le 1ᵉʳ finit par
 * "/", le 2ᵉ contient le dernier artiste). On concat tout jusqu'au prochain
 * séparateur (`───`, lien `[Available`, ou ligne vide après une ligne sans /).
 */
function extractArtistsRaw(section: string): string[] {
  const lines = section.split('\n')
  // Trouver l'index de la ligne marker.
  let startIdx = -1
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (
      /\*\*\s*Line\s*up\s*\*\*/i.test(line) ||
      /highlight\s+broadcast.*?from/i.test(line) ||
      /previous\s+stages/i.test(line)
    ) {
      startIdx = i
      break
    }
  }
  if (startIdx === -1) return []

  // Collecter les lignes après le marker jusqu'à un séparateur.
  const collected: string[] = []
  for (let i = startIdx + 1; i < lines.length; i++) {
    const raw = lines[i]
    const line = raw.trim()
    if (!line) {
      // Une ligne vide après qu'on a déjà collecté quelque chose qui ne finit
      // pas par "/" termine la collecte. Sinon on continue (Inkigayo cas).
      if (collected.length > 0 && !collected[collected.length - 1].trim().endsWith('/')) break
      continue
    }
    // Stop markers.
    if (/^[─⋆⋅☆]+$/u.test(line)) break
    if (/^\[Available/i.test(line)) break
    if (/^#\s*\[Available/i.test(line)) break
    if (/^\*\s*\[Back/i.test(line)) break
    if (/^\*\s*\[/.test(line)) break // bullet link list
    if (/^\*The/i.test(line)) break // "*The lineup is subject to change"
    if (/^\*Note/i.test(line)) break
    if (/^\*Needs/i.test(line)) break
    if (/^\*\s/.test(line)) break // bullet
    collected.push(line)
  }

  // Joindre + split sur " / ".
  const joined = collected.join(' ')
  // Strip un éventuel "[Available...](...)" résiduel inline (Music Bank).
  const cleaned = joined.replace(/#?\s*\[Available[^\]]*\]\([^)]*\)/gi, '')
  const parts = cleaned
    .split('/')
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
  // Filtrer les bouts qui ressemblent à du noise post-lineup
  // ("The winner should still be announced later!" après le dernier artiste).
  const NOISE = /winner|announced|later|highlight/i
  const stopAt = parts.findIndex((p) => NOISE.test(p))
  return stopAt === -1 ? parts : parts.slice(0, stopAt)
}

/** Pure parser : markdown → liste de lineups bruts. Pas de fetch. */
export function parseLineups(markdown: string): RawLineup[] {
  const out: RawLineup[] = []
  for (const section of splitSections(markdown)) {
    const show = detectShow(section)
    if (!show) continue
    const episodeNumber = parseEpisodeNumber(section)
    if (episodeNumber === null) continue
    const td = parseTimeAndDate(section)
    if (!td) continue
    const artistsRaw = extractArtistsRaw(section)
    if (artistsRaw.length === 0) continue
    out.push({
      show,
      episodeNumber,
      monthDay: td.monthDay,
      time12h: td.time12h,
      isHighlight: isHighlightBroadcast(section),
      artistsRaw,
    })
  }
  return out
}

/**
 * Convertit `MM/DD` + `HH:MMam/pm` (KST) en ISO UTC.
 * Inférence d'année : on choisit l'année qui place la date la plus proche de
 * `now` dans une fenêtre ±180 jours. Couvre le cas wrap fin/début d'année.
 */
export function buildStartAtIso(monthDay: string, time12h: string, now: Date): string | null {
  const dm = monthDay.match(/^(\d{1,2})\/(\d{1,2})$/)
  if (!dm) return null
  const month = Number(dm[1])
  const day = Number(dm[2])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  const tm = time12h.toLowerCase().match(/^(\d{1,2}):(\d{2})(am|pm)$/)
  if (!tm) return null
  let hour = Number(tm[1])
  const minute = Number(tm[2])
  const period = tm[3]
  if (period === 'pm' && hour !== 12) hour += 12
  if (period === 'am' && hour === 12) hour = 0
  if (hour > 23 || minute > 59) return null

  // Trouve l'année la plus proche.
  const candidates = [now.getUTCFullYear() - 1, now.getUTCFullYear(), now.getUTCFullYear() + 1]
  const nowMs = now.getTime()
  let bestIso: string | null = null
  let bestDelta = Infinity
  for (const year of candidates) {
    // KST = UTC+9. On veut une date qui représente "year-month-day HH:MM en KST".
    // En UTC, c'est "year-month-day HH:MM" minus 9h.
    const utcHour = hour - 9
    const ms = Date.UTC(year, month - 1, day, utcHour, minute)
    const delta = Math.abs(ms - nowMs)
    if (delta < bestDelta) {
      bestDelta = delta
      bestIso = new Date(ms).toISOString()
    }
  }
  return bestIso
}

export function withStartAt(lineups: RawLineup[], now: Date): ParsedLineup[] {
  const out: ParsedLineup[] = []
  for (const l of lineups) {
    const iso = buildStartAtIso(l.monthDay, l.time12h, now)
    if (!iso) continue
    out.push({ ...l, startAtIso: iso })
  }
  return out
}

/** Fetch + parse. Renvoie les lineups avec date ISO calculée. */
export async function fetchAllLineups(now: Date = new Date()): Promise<ParsedLineup[]> {
  const res = await fetch(JINA_URL, {
    headers: { 'user-agent': 'KStageBot/0.1 (+https://kstage.vercel.app)' },
  })
  if (!res.ok) throw new Error(`liveshowupdatess fetch failed: HTTP ${res.status}`)
  const markdown = await res.text()
  return withStartAt(parseLineups(markdown), now)
}
