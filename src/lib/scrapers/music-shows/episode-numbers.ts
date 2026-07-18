// Numérotation d'épisodes par AUTORITÉ Wikipedia (round 2026-07-18).
// Les numéros parsés du carrd se sont avérés faux (« Music Bank 1295 » du
// 2026-07-17 = épisode 1299 d'après « List of Music Bank Chart winners
// (2026) » ; le « 1294 » du 05/06 = 1293) → on ne DEVINE jamais : les pages
// « List of {show} Chart winners (YYYY) » portent (épisode, date) sourcés.
// Parser pur + validateur, consommés par scripts/backfill-episode-numbers.ts.

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
}

export type AuthorityEpisode = { episode: number; date: string }

/**
 * Extrait les paires (épisode, date) d'une page « Chart winners » :
 *   ! scope="row" … | 1,299
 *   | {{dts|July 17}}            (année implicite = celle de la page)
 * Tolère l'année explicite ({{dts|July 17|2026}} / {{dts|2026|7|17}} non vu
 * mais le mois textuel reste la forme des pages vérifiées).
 */
export function parseChartWinnersWikitext(wikitext: string, year: number): AuthorityEpisode[] {
  const out: AuthorityEpisode[] = []
  const re =
    /!\s*scope="row"[^\n]*\|\s*([\d,]+)\s*\n\|\s*\{\{dts\|([A-Za-z]+)\s+(\d{1,2})(?:,?\s*(\d{4}))?\}\}/g
  for (const m of wikitext.matchAll(re)) {
    const episode = Number(m[1].replace(/,/g, ''))
    const month = MONTHS[m[2].toLowerCase()]
    const day = Number(m[3])
    const y = m[4] ? Number(m[4]) : year
    if (!episode || !month || !day) continue
    out.push({
      episode,
      date: `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    })
  }
  return out
}

/**
 * Valide la cohérence interne d'une liste d'autorité : dates strictement
 * croissantes ⇒ épisodes strictement croissants, pas de doublon. Renvoie les
 * anomalies (liste vide = OK) — une autorité incohérente n'est PAS appliquée.
 */
export function validateAuthority(episodes: readonly AuthorityEpisode[]): string[] {
  const problems: string[] = []
  const sorted = [...episodes].sort((a, b) => a.date.localeCompare(b.date))
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const cur = sorted[i]
    if (cur.date === prev.date && cur.episode !== prev.episode) {
      problems.push(`deux épisodes le même jour ${cur.date} (#${prev.episode}/#${cur.episode})`)
    }
    if (cur.episode <= prev.episode && cur.date !== prev.date) {
      problems.push(
        `épisodes non croissants : #${prev.episode} (${prev.date}) puis #${cur.episode} (${cur.date})`,
      )
    }
  }
  return problems
}
