/**
 * Application de l'AUTORITÉ Wikipedia sur la numérotation des épisodes.
 *
 * Le parseur et le validateur vivent dans `episode-numbers.ts` (round
 * 2026-07-18) ; ici l'orchestration DB, partagée par
 * `scripts/backfill-episode-numbers.ts` et le cron `aired-shows` — jusqu'au
 * 2026-08-21 la correction n'existait qu'en script manuel, donc en pratique
 * elle ne tournait jamais et 9 épisodes diffusés restaient sans numéro.
 *
 * Règle inchangée : on ne calcule JAMAIS un numéro par arithmétique sur un
 * trou. Une liste d'autorité incohérente n'est pas appliquée du tout.
 */

import type { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { parseChartWinnersWikitext, validateAuthority } from './episode-numbers'
import { parseChartWinners, type ChartWinner } from './chart-winners'
import { normalize } from '@/lib/scrapers/group-match'

type SupabaseClient = ReturnType<typeof createClient<Database>>

/** show_title DB → page « List of … Chart winners (YYYY) ». */
export const WIKI_PAGES: Record<string, (year: number) => string> = {
  'Music Bank': (y) => `List of Music Bank Chart winners (${y})`,
  Inkigayo: (y) => `List of Inkigayo Chart winners (${y})`,
  'M Countdown': (y) => `List of M Countdown Chart winners (${y})`,
  'Music Core': (y) => `List of Show! Music Core Chart winners (${y})`,
  'Show Champion': (y) => `List of Show Champion Chart winners (${y})`,
  'The Show': (y) => `List of The Show Chart winners (${y})`,
}

export interface AuthorityResult {
  pagesRead: number
  filled: number
  corrected: number
  /** Épisodes sans numéro que l'autorité ne couvre pas non plus. */
  stillMissing: number
  /** Numéros effacés parce que l'autorité les attribue à une AUTRE date. */
  cleared: number
  /** Pages écartées car internement contradictoires. */
  incoherent: string[]
  /** Épisodes dont le vainqueur a été écrit ou mis à jour. */
  winnersSet: number
  /** Vainqueurs dont le nom ne correspond à aucun groupe du roster. */
  winnersUnmatched: string[]
  changes: string[]
}

/**
 * Résout le nom d'artiste écrit par Wikipedia vers un groupe du roster.
 *
 * ÉGALITÉ normalisée uniquement, sur le nom ou un alias — jamais de
 * containment, jamais d'approximation. Un vainqueur mal attribué serait
 * affiché comme un fait sourcé. Sans correspondance on garde le nom BRUT : la
 * page dit qui a gagné, elle ne prétend simplement pas que c'est quelqu'un de
 * notre roster.
 */
export function resolveWinnerGroup(
  artist: string,
  groups: readonly { id: string; name: string; name_aliases: string[] | null }[],
): string | null {
  const needle = normalize(artist)
  if (!needle) return null
  const hits = groups.filter(
    (g) =>
      normalize(g.name) === needle || (g.name_aliases ?? []).some((a) => normalize(a) === needle),
  )
  // Deux groupes au même nom normalisé : ambigu, on s'abstient.
  return hits.length === 1 ? hits[0].id : null
}

async function fetchWikitext(pageTitle: string): Promise<string | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(
    pageTitle,
  )}&prop=wikitext&format=json`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'KStage/1.0 (https://kstage.app; episode numbering)' },
  })
  if (!res.ok) return null
  const data = (await res.json()) as { parse?: { wikitext?: { '*': string } } }
  return data.parse?.wikitext?.['*'] ?? null
}

function dayBounds(kstDay: string): { from: string; to: string } {
  const from = new Date(`${kstDay}T00:00:00+09:00`)
  return { from: from.toISOString(), to: new Date(from.getTime() + 86_400_000).toISOString() }
}

export async function applyEpisodeAuthority(
  supabase: SupabaseClient,
  opts: { apply?: boolean; sinceKstDay?: string } = {},
): Promise<AuthorityResult> {
  const apply = opts.apply ?? true
  const result: AuthorityResult = {
    pagesRead: 0,
    filled: 0,
    corrected: 0,
    stillMissing: 0,
    cleared: 0,
    incoherent: [],
    winnersSet: 0,
    winnersUnmatched: [],
    changes: [],
  }

  let query = supabase
    .from('show_episodes')
    .select(
      'id, show_title, kst_day, episode_number, winner_group_id, winner_name, winner_song, winner_nth',
    )
    .order('kst_day')
  if (opts.sinceKstDay) query = query.gte('kst_day', opts.sinceKstDay)
  const { data: episodes } = await query
  if (!episodes || episodes.length === 0) return result

  // Roster chargé une fois pour la résolution des vainqueurs (260 lignes).
  const { data: roster } = await supabase.from('groups').select('id, name, name_aliases')

  const yearsByShow = new Map<string, Set<number>>()
  for (const e of episodes) {
    const set = yearsByShow.get(e.show_title) ?? new Set<number>()
    set.add(Number(e.kst_day.slice(0, 4)))
    yearsByShow.set(e.show_title, set)
  }

  for (const [show, years] of yearsByShow) {
    const pageOf = WIKI_PAGES[show]
    if (!pageOf) continue
    const authority = new Map<string, number>()
    const winners = new Map<string, ChartWinner>()
    for (const year of years) {
      const title = pageOf(year)
      const wikitext = await fetchWikitext(title)
      result.pagesRead++
      if (!wikitext) continue
      // La MÊME page porte le vainqueur : on le lit dans la foulée, sans
      // requête supplémentaire.
      //
      // Et on le lit MÊME si la numérotation de la page est incohérente : les
      // deux faits sont indépendants et clés différemment (le vainqueur par
      // DATE, le numéro par colonne épisode). Cas réel : la page Music Core
      // 2026 écrit « 952 » sur le 27/06 ET le 04/07 — une coquille de la
      // colonne épisode, qui ne dit rien de « I.O.I a gagné le 27/06 », ligne
      // par ailleurs sourcée par deux références. Écarter la page entière
      // priverait un show sur six de ses ~30 vainqueurs pour une faute de
      // frappe dans une autre colonne.
      for (const w of parseChartWinners(wikitext, year)) winners.set(w.date, w)

      const parsed = parseChartWinnersWikitext(wikitext, year)
      const problems = validateAuthority(parsed)
      if (problems.length > 0) {
        result.incoherent.push(`${title}: ${problems[0]}`)
        continue
      }
      for (const p of parsed) authority.set(p.date, p.episode)
    }

    for (const row of episodes.filter((e) => e.show_title === show)) {
      const auth = authority.get(row.kst_day)
      if (auth == null) {
        if (row.episode_number == null) result.stillMissing++
        continue
      }
      if (row.episode_number === auth) continue
      if (row.episode_number == null) result.filled++
      else result.corrected++
      result.changes.push(
        `${show} ${row.kst_day} : ${row.episode_number == null ? 'null' : `#${row.episode_number}`} → #${auth}`,
      )
      if (!apply) continue
      await supabase.from('show_episodes').update({ episode_number: auth }).eq('id', row.id)
      // Les rows events du même épisode portent aussi le numéro (affiché sur
      // la tuile) : elles suivent l'autorité dans le même mouvement.
      const { from, to } = dayBounds(row.kst_day)
      await supabase
        .from('events')
        .update({ episode_number: auth })
        .eq('type', 'music_show')
        .eq('title', show)
        .gte('start_at', from)
        .lt('start_at', to)
    }

    // Un numéro attribué par l'autorité à une date ne peut pas en décorer une
    // autre : toute homonymie restante est PROUVÉE fausse, on l'efface plutôt
    // que de la corriger par arithmétique. Cas réel (2026-08-21) : le carrd
    // avait posé #1321 sur l'Inkigayo du 23/08, numéro que Wikipedia attribue
    // au 16/08 — les deux s'affichaient « Inkigayo #1321 ».
    const takenByDay = new Map([...authority].map(([day, num]) => [num, day]))
    for (const row of episodes.filter((e) => e.show_title === show)) {
      if (row.episode_number == null) continue
      const owner = takenByDay.get(row.episode_number)
      if (!owner || owner === row.kst_day) continue
      result.cleared++
      result.changes.push(
        `${show} ${row.kst_day} : #${row.episode_number} effacé (l'autorité l'attribue au ${owner})`,
      )
      if (!apply) continue
      await supabase.from('show_episodes').update({ episode_number: null }).eq('id', row.id)
      const { from, to } = dayBounds(row.kst_day)
      await supabase
        .from('events')
        .update({ episode_number: null })
        .eq('type', 'music_show')
        .eq('title', show)
        .gte('start_at', from)
        .lt('start_at', to)
    }

    // ── Vainqueurs ──────────────────────────────────────────────────────
    for (const row of episodes.filter((e) => e.show_title === show)) {
      const w = winners.get(row.kst_day)
      if (!w) continue
      const groupId = resolveWinnerGroup(w.artist, roster ?? [])
      const unchanged =
        row.winner_name === w.artist &&
        row.winner_song === w.song &&
        row.winner_nth === w.nth &&
        row.winner_group_id === groupId
      if (unchanged) continue
      result.winnersSet++
      if (!groupId) result.winnersUnmatched.push(`${show} ${row.kst_day} : ${w.artist}`)
      result.changes.push(
        `${show} ${row.kst_day} : vainqueur ${w.artist}${w.nth ? ` (#${w.nth})` : ''}${
          groupId ? '' : ' [hors roster]'
        }`,
      )
      if (!apply) continue
      await supabase
        .from('show_episodes')
        .update({
          winner_group_id: groupId,
          winner_name: w.artist,
          winner_song: w.song,
          winner_nth: w.nth,
        })
        .eq('id', row.id)
    }
  }

  return result
}
