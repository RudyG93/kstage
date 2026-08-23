import { unstable_cache } from 'next/cache'
import { createClient as createAnonClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getMonthRangeInZone, localDayKey } from './date'
import type { Database } from '@/types/database'

type EventType = Database['public']['Enums']['event_type']

const EVENT_SELECT =
  'id, group_id, slug, title, type, start_at, status, episode_number, source_url, stage_url, groups!inner(slug, artist_slug, name, color_hex, image_url, image_landscape, banner_url)'

// Predicate appliqué partout sauf getGroupMvs (cf. matrice §8 SCRAPING.md) :
// les MVs `main` + les non-MV (mv_kind=NULL) sont visibles. Les versions
// performance/member/other_version sont filtrées.
// Exporté pour les contextes sans cookies (feed iCal service-role).
export const isMainOrNonMv = 'mv_kind.eq.main,mv_kind.is.null'

export async function getUpcomingEvents({
  groupSlug,
  types,
  groupIds,
  limit = 50,
}: {
  groupSlug?: string
  types?: readonly EventType[]
  groupIds?: string[]
  limit?: number
} = {}) {
  const supabase = await createClient()
  let query = supabase
    .from('events')
    .select(EVENT_SELECT)
    .eq('hidden', false)
    .gte('start_at', new Date().toISOString())
    .or(isMainOrNonMv)
    .order('start_at', { ascending: true })
    .limit(limit)

  if (groupSlug) query = query.eq('groups.slug', groupSlug)
  if (groupIds) query = query.in('group_id', groupIds)
  if (types && types.length > 0) query = query.in('type', types as EventType[])

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

/**
 * Nombre d'events (toutes dates et types confondus) par group_id — proxy « ce
 * groupe a-t-il du contenu réel » (events à venir ou catalogue MV passé). Sert à
 * piloter les surfaces de promotion (onboarding P0.6) vers les groupes au
 * calendrier non vide, sans figer la sélection sur les seuls follows (≈ 0 sur un
 * compte neuf). Les anniversaires (générés à la volée) ne comptent pas : ils sont
 * du contenu plancher, pas un critère de mise en avant.
 */
export async function getGroupEventCounts(): Promise<Map<string, number>> {
  // RPC plutôt qu'un select : la version qui rapatriait les lignes pour les
  // compter en TS n'en recevait que 1000 sur 4165 (plafond PostgREST, aucune
  // erreur levée). 102 des 260 groupes ressortaient à 0 et passaient donc pour
  // « sans contenu » dans le tri de l'onboarding, écran d'accueil des
  // nouveaux comptes. Postgres agrège, on transporte 260 lignes.
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('group_event_counts')
  if (error) throw error
  return new Map((data ?? []).map((r) => [r.group_id, Number(r.events)]))
}

export async function getEventsForMonth({
  year,
  month,
  timeZone = 'Asia/Seoul',
  groupSlugs,
  types,
}: {
  year: number
  month: number
  /** Fuseau qui DESSINE la grille : la fenêtre doit être la sienne, pas KST. */
  timeZone?: string
  groupSlugs?: string[]
  types?: readonly EventType[]
}) {
  const supabase = await createClient()
  const { startISO, endISO } = getMonthRangeInZone(year, month, timeZone)
  let query = supabase
    .from('events')
    .select(EVENT_SELECT)
    .eq('hidden', false)
    .gte('start_at', startISO)
    .lt('start_at', endISO)
    .or(isMainOrNonMv)
    .order('start_at', { ascending: true })

  if (groupSlugs && groupSlugs.length > 0) query = query.in('groups.slug', groupSlugs)
  if (types && types.length > 0) query = query.in('type', types as EventType[])

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getUpcomingEventCountsByGroup(
  groupIds: string[],
): Promise<Map<string, number>> {
  if (groupIds.length === 0) return new Map()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('events')
    .select('group_id')
    .in('group_id', groupIds)
    .gte('start_at', new Date().toISOString())
    .or(isMainOrNonMv)
    .eq('hidden', false)
  if (error) throw error
  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    counts.set(row.group_id, (counts.get(row.group_id) ?? 0) + 1)
  }
  return counts
}

export async function getRecentComebacks(limit = 3) {
  // mv_kind='main' uniquement : la sidebar Recent comebacks doit montrer le
  // clip principal, pas les versions Performance/Member/Other (cf. matrice
  // de visibilité §8 SCRAPING.md).
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('events')
    .select('id, slug, type, title, start_at, image_url, groups!inner(name, slug)')
    .eq('type', 'mv')
    .eq('mv_kind', 'main')
    .eq('hidden', false)
    .lt('start_at', new Date().toISOString())
    .order('start_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

const MV_SELECT =
  'id, slug, title, type, start_at, source_url, image_url, mv_kind, groups!inner(slug, artist_slug, name, color_hex, image_url)'

/**
 * Tous les MVs d'un groupe (passés inclus), pour la section "Music videos"
 * de la page /groups/[slug]. Garde main + performance (versions de groupe) ;
 * exclut member (réservé à /artists/[slug]) et other_version.
 *
 * `total` à part de `rows` pour la même raison que `getGroupStages` : le
 * titre affiche « Music videos (N) » et 3 groupes dépassent déjà la limite de
 * 48 (57 au maximum) — ils annonçaient donc 48, le plafond.
 */
export async function getGroupMvs(slug: string, limit = 48) {
  const supabase = await createClient()
  const { data, error, count } = await supabase
    .from('events')
    .select(MV_SELECT, { count: 'exact' })
    .eq('groups.slug', slug)
    .eq('type', 'mv')
    .in('mv_kind', ['main', 'performance'])
    .eq('hidden', false)
    .order('start_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  const rows = data ?? []
  return { rows, total: count ?? rows.length }
}

/**
 * Passages music-show PASSÉS d'un groupe.
 *
 * Ces lignes existaient sans surface (2026-08-21) : la page groupe n'affichait
 * que les events à VENIR, donc les scènes liées n'étaient atteignables que par
 * le calendrier, à la bonne date.
 *
 * Deux corrections le 2026-08-22, après un « 13 passages dans le rail, 11 sur
 * la page » relevé par Rudy sur Kiss of Life :
 *
 * - **plus de filtre `stage_url`.** Il masquait les passages dont le diffuseur
 *   n'a pas encore posté la vidéo — 69 sur 713 — c'est-à-dire justement les
 *   plus récents, ceux qu'on vient chercher. Le passage a eu lieu : la page le
 *   dit, et la vignette renvoie vers l'épisode en attendant la vidéo.
 * - **`total` séparé de `rows`.** Les pages affichaient `rows.length` comme
 *   compteur, or `rows` est plafonné : 13 groupes dépassaient la limite et
 *   annonçaient donc le plafond au lieu de leur total.
 */
export async function getGroupStages(slug: string, limit = 24) {
  const supabase = await createClient()
  const { data, error, count } = await supabase
    .from('events')
    // groups!inner requis : PostgREST ne filtre sur `groups.slug` que si la
    // relation est EMBARQUÉE dans le select (PGRST200 sinon).
    .select('id, title, start_at, episode_number, stage_url, image_url, groups!inner(slug)', {
      count: 'exact',
    })
    .eq('groups.slug', slug)
    .eq('type', 'music_show')
    .eq('hidden', false)
    .lt('start_at', new Date().toISOString())
    .order('start_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  const rows = data ?? []
  return { rows, total: count ?? rows.length }
}

export type GroupStage = Awaited<ReturnType<typeof getGroupStages>>['rows'][number]

/**
 * MVs SOLO d'un membre (mv_kind='member', member_id) — surfacés sur sa page
 * /artists/[slug] (R10). Ces MVs étaient collectés mais jamais affichés
 * (getGroupMvs les exclut, la branche membre ne les requêtait pas).
 */
export async function getMemberMvs(memberId: string, limit = 24) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('events')
    .select(MV_SELECT)
    .eq('member_id', memberId)
    .eq('type', 'mv')
    .eq('mv_kind', 'member')
    .eq('hidden', false)
    .order('start_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

/**
 * Liste globale des MVs (main only), optionnellement restreinte à un set de
 * groupes (utilisé pour la section "From your groups" sur /mvs).
 */
export async function getAllMvs(options: { groupIds?: string[]; limit?: number } = {}) {
  const { groupIds, limit = 100 } = options
  const supabase = await createClient()
  let query = supabase
    .from('events')
    .select(MV_SELECT)
    .eq('type', 'mv')
    .eq('mv_kind', 'main')
    .eq('hidden', false)
    .order('start_at', { ascending: false })
    .limit(limit)
  if (groupIds && groupIds.length > 0) query = query.in('group_id', groupIds)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

/**
 * Page de MVs pour la grille « Latest drops », curseur en main.
 *
 * `/mvs` servait 31 clips sur les 3 173 du catalogue, sans aucun moyen d'aller
 * plus loin. Pagination par CURSEUR COMPOSITE `(start_at, id)` et pas par
 * offset : 27 valeurs de `start_at` sont en doublon en base, un curseur sur la
 * seule date sauterait des lignes ou en répéterait. Pas de `?page=` non plus —
 * R5 a démonté les pills `<Link>` parce que chaque clic re-rendait la page.
 */
export interface MvCursor {
  startAt: string
  id: string
}

export function encodeMvCursor(c: MvCursor): string {
  return `${c.startAt}|${c.id}`
}

export function decodeMvCursor(raw: string): MvCursor | null {
  const at = raw.indexOf('|')
  if (at <= 0) return null
  const startAt = raw.slice(0, at)
  const id = raw.slice(at + 1)
  // Format strict : ces valeurs partent dans un filtre PostgREST.
  if (!/^[\d:.TZ+-]{10,40}$/.test(startAt)) return null
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  return { startAt, id }
}

export async function getMvsPage(options: { cursor?: MvCursor | null; limit?: number } = {}) {
  const { cursor, limit = 30 } = options
  const supabase = await createClient()
  let query = supabase
    .from('events')
    .select(MV_SELECT)
    .eq('type', 'mv')
    .eq('mv_kind', 'main')
    .eq('hidden', false)
    .order('start_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)
  if (cursor) {
    // `start_at < X OR (start_at = X AND id < Y)` — la clause keyset. Ni la
    // date ISO ni l'UUID ne contiennent de virgule, qui casserait le `.or()`.
    query = query.or(
      `start_at.lt.${cursor.startAt},and(start_at.eq.${cursor.startAt},id.lt.${cursor.id})`,
    )
  }
  const { data, error } = await query
  if (error) throw error
  const rows = data ?? []
  const last = rows[rows.length - 1]
  return {
    rows,
    // Curseur nul dès qu'une page est incomplète : c'était la dernière.
    nextCursor:
      rows.length === limit && last
        ? encodeMvCursor({ startAt: last.start_at, id: last.id })
        : null,
  }
}

/**
 * Dernière victoire en music show d'un groupe — source Wikipedia, écrite par
 * `applyEpisodeAuthority` dans `show_episodes`.
 *
 * On rend la DERNIÈRE, jamais un cumul : notre base ne couvre que quelques
 * mois de passages, un total calculé chez nous serait faux tout en ayant l'air
 * sourcé. Le rang (« 16th win ») vient de Wikipedia, qui compte depuis les
 * débuts du groupe.
 */
export async function getLatestShowWin(groupId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('show_episodes')
    .select('show_title, kst_day, episode_number, winner_song, winner_nth')
    .eq('winner_group_id', groupId)
    .order('kst_day', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * Vainqueurs des music shows sur les `days` derniers jours.
 *
 * La donnée existe depuis le 2026-08-23 mais n'a AUCUNE vue d'ensemble : le
 * vainqueur se lit sur la page d'un épisode ou sur la page d'un groupe, jamais
 * « qui a gagné cette semaine ». C'est pourtant la question que le fandom pose
 * chaque week-end — 6 lignes par semaine, une par show, mesuré.
 */
export async function getRecentShowWins(days = 7, limit = 6) {
  const supabase = await createClient()
  // `kst_day` est un jour civil KST : le comparer à une date UTC décalait la
  // fenêtre de 8 ou 9 jours selon l'heure, JAMAIS 7. Conséquence visible : un
  // show préempté (결방, fréquent) faisait remonter son vainqueur de la semaine
  // PRÉCÉDENTE sous un titre affirmant « this week ».
  const today = localDayKey(new Date().toISOString(), 'Asia/Seoul')
  const since = new Date(Date.parse(`${today}T00:00:00Z`) - (days - 1) * 86_400_000)
    .toISOString()
    .slice(0, 10)
  const { data, error } = await supabase
    .from('show_episodes')
    .select(
      'show_title, kst_day, episode_number, winner_name, winner_song, winner_nth, groups(slug, name, image_url)',
    )
    .not('winner_name', 'is', null)
    .gte('kst_day', since)
    // Borne haute : la base porte déjà des épisodes à `kst_day` futur (lineups
    // scrapés en avance). Le jour où l'un d'eux reçoit un vainqueur, il
    // prendrait la tête du tri et s'afficherait comme vainqueur « this week ».
    .lte('kst_day', today)
    .order('kst_day', { ascending: false })
    // Marge : la fenêtre inclut ses deux bornes, un show peut donc y avoir
    // deux épisodes. On récupère large et on déduplique juste après.
    .limit(limit * 3)
  if (error) throw error
  // UNE ligne par show, la plus récente. Sans ça la liste affichait deux fois
  // Inkigayo (dimanche J et dimanche J-7) pendant qu'un autre show manquait —
  // « qui a gagné cette semaine » doit répondre show par show.
  const perShow = new Map<string, NonNullable<typeof data>[number]>()
  for (const row of data ?? []) {
    if (!perShow.has(row.show_title)) perShow.set(row.show_title, row)
  }
  return [...perShow.values()].slice(0, limit)
}

export type ShowWin = Awaited<ReturnType<typeof getRecentShowWins>>[number]

/**
 * « Il y a N ans, jour pour jour » — MVs sortis ce même jour civil KST lors
 * d'une année précédente.
 *
 * Un catalogue de 3 173 clips ne sert que le récent : rien ne fait remonter
 * l'archive. 9,7 clips partagent le jour civil du jour en moyenne — le tri par
 * ancienneté décroissante met « il y a 10 ans » devant, la formulation qui
 * frappe. C'est la seule mécanique du produit qui donne une raison de revenir
 * un jour où il ne sort rien.
 */
const ON_THIS_DAY_YEARS = 12

export async function getOnThisDayMvs(limit = 4) {
  const supabase = await createClient()
  // Le jour civil KST, pas UTC : une sortie du 1er à 00:00 KST est le 31 en UTC.
  const [year, month, day] = localDayKey(new Date().toISOString(), 'Asia/Seoul')
    .split('-')
    .map(Number)

  // Une requête par année plutôt qu'un filtre sur mois/jour : PostgREST ne sait
  // pas exprimer `extract(...)`, et une RPC pour quatre lignes serait une
  // migration de trop. Les fenêtres sont d'un jour, l'index sur start_at joue.
  //
  // TOUTES les années EN PARALLÈLE, et on ne tranche qu'après. Une sortie
  // anticipée sur un compteur cumulé — la première version — affamait les
  // années les PLUS ANCIENNES, exactement celles que le bloc existe pour
  // montrer : en descendant depuis l'année récente, elle s'arrêtait avant
  // d'avoir interrogé 2016 un 1er novembre, alors que quatre clips y dorment.
  // Le tri final prétendait alors rendre les plus anciens d'un ensemble
  // incomplet. Trois jours de l'année étaient déjà touchés, et ce nombre
  // grossit à chaque scrape.
  const years = Array.from({ length: ON_THIS_DAY_YEARS }, (_, i) => year - 1 - i)
  const batches = await Promise.all(
    years.map(async (y) => {
      // Le 29 février n'existe pas les années non bissextiles : `Date.UTC`
      // déborderait silencieusement sur le 1er mars et rendrait les clips du
      // mauvais jour. On saute l'année plutôt que de mentir.
      const probe = new Date(Date.UTC(y, month - 1, day))
      if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return []
      const from = new Date(Date.UTC(y, month - 1, day, 0, 0) - 9 * 3_600_000).toISOString()
      const to = new Date(Date.UTC(y, month - 1, day, 24, 0) - 9 * 3_600_000).toISOString()
      const { data, error } = await supabase
        .from('events')
        .select(MV_SELECT)
        .eq('type', 'mv')
        .eq('mv_kind', 'main')
        .eq('hidden', false)
        .gte('start_at', from)
        .lt('start_at', to)
        .order('start_at', { ascending: false })
        .limit(3)
      // Une erreur avalée ici ferait disparaître une année en silence — le
      // même défaut que l'early-exit, en moins visible encore.
      if (error) throw error
      return (data ?? []) as MvEvent[]
    }),
  )
  // Le plus ancien d'abord : « 10 ans » porte plus que « 1 an ». `year` sert
  // aussi au libellé côté composant : il est rendu ici pour que l'affichage
  // n'ait pas à le recalculer (en UTC, il se trompait 9 h par an).
  const rows = batches.flat().sort((a, b) => a.start_at.localeCompare(b.start_at))
  return { rows: rows.slice(0, limit), referenceYear: year }
}

/** Nombre total d'events suivis (proof bar de la landing §7.9). Head-only. */
export async function getEventsCount(): Promise<number> {
  const supabase = await createClient()
  const { count } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('hidden', false)
  return count ?? 0
}

/**
 * Prochain event (futur) par groupe — ligne statut des tuiles Groups et
 * contexte du panneau Trending (Data Desk §7.5). Un fetch, réduction en TS.
 */
export async function getNextEventForGroups(
  groupIds: string[],
): Promise<Map<string, { type: EventType; start_at: string; title: string }>> {
  const out = new Map<string, { type: EventType; start_at: string; title: string }>()
  if (groupIds.length === 0) return out
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('events')
    .select('group_id, type, start_at, title')
    .in('group_id', groupIds)
    .eq('hidden', false)
    .gte('start_at', new Date().toISOString())
    .or(isMainOrNonMv)
    .order('start_at', { ascending: true })
  if (error) throw error
  for (const e of data ?? []) {
    if (!e.group_id || out.has(e.group_id)) continue
    out.set(e.group_id, { type: e.type, start_at: e.start_at, title: e.title })
  }
  return out
}

/**
 * Variante `unstable_cache` de getNextEventForGroups pour TOUS les groupes
 * (audit perf 2026-08-20 : /groups la recalcule à chaque vue alors que le
 * résultat est identique pour tous les viewers). Client anon (unstable_cache
 * interdit cookies) ; retour en paires (une Map ne survit pas à la
 * sérialisation JSON du cache), reconstruite au retour. Tag `events` revalidé
 * en fin de cron scraping (logScrapeRun) ; le `now` figé entre deux
 * régénérations (≤ 15 min) ne décale que la ligne statut des tuiles.
 */
const getNextEventPairsCached = unstable_cache(
  async (): Promise<[string, { type: EventType; start_at: string; title: string }][]> => {
    const supabase = createAnonClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { data, error } = await supabase
      .from('events')
      .select('group_id, type, start_at, title')
      .eq('hidden', false)
      .gte('start_at', new Date().toISOString())
      .or(isMainOrNonMv)
      .order('start_at', { ascending: true })
    if (error) throw error
    const out = new Map<string, { type: EventType; start_at: string; title: string }>()
    for (const e of data ?? []) {
      if (!e.group_id || out.has(e.group_id)) continue
      out.set(e.group_id, { type: e.type, start_at: e.start_at, title: e.title })
    }
    return [...out]
  },
  ['next-event-all-groups'],
  { revalidate: 900, tags: ['events'] },
)

export async function getNextEventForAllGroupsCached(): Promise<
  Map<string, { type: EventType; start_at: string; title: string }>
> {
  return new Map(await getNextEventPairsCached())
}

/**
 * Dernière sortie RÉCENTE (mv main ou release ≤ `days` jours) par groupe —
 * signal « recency » du panneau Trending (2026-07-11). Un fetch, réduction TS.
 */
export async function getRecentReleasesForGroups(
  groupIds: string[],
  days = 30,
): Promise<Map<string, { type: EventType; start_at: string; title: string }>> {
  const out = new Map<string, { type: EventType; start_at: string; title: string }>()
  if (groupIds.length === 0) return out
  const supabase = await createClient()
  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  const { data, error } = await supabase
    .from('events')
    .select('group_id, type, start_at, title')
    .in('group_id', groupIds)
    .in('type', ['mv', 'release'])
    .eq('hidden', false)
    .or(isMainOrNonMv)
    .gte('start_at', since)
    .lte('start_at', new Date().toISOString())
    .order('start_at', { ascending: false })
  if (error) throw error
  for (const e of data ?? []) {
    if (!e.group_id || out.has(e.group_id)) continue
    out.set(e.group_id, { type: e.type, start_at: e.start_at, title: e.title })
  }
  return out
}

/** Variante cached « tous groupes » de getRecentReleasesForGroups — mêmes
    raisons/mécanique que getNextEventForAllGroupsCached (fenêtre 30 j). */
const getRecentReleasePairsCached = unstable_cache(
  async (): Promise<[string, { type: EventType; start_at: string; title: string }][]> => {
    const supabase = createAnonClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
    const { data, error } = await supabase
      .from('events')
      .select('group_id, type, start_at, title')
      .in('type', ['mv', 'release'])
      .eq('hidden', false)
      .or(isMainOrNonMv)
      .gte('start_at', since)
      .lte('start_at', new Date().toISOString())
      .order('start_at', { ascending: false })
    if (error) throw error
    const out = new Map<string, { type: EventType; start_at: string; title: string }>()
    for (const e of data ?? []) {
      if (!e.group_id || out.has(e.group_id)) continue
      out.set(e.group_id, { type: e.type, start_at: e.start_at, title: e.title })
    }
    return [...out]
  },
  ['recent-releases-all-groups'],
  { revalidate: 900, tags: ['events'] },
)

export async function getRecentReleasesForAllGroupsCached(): Promise<
  Map<string, { type: EventType; start_at: string; title: string }>
> {
  return new Map(await getRecentReleasePairsCached())
}

/**
 * Events FUTURS fraîchement détectés par les scrapers (« Just announced »,
 * rail /calendar — Lot 6 rails contextuels 2026-08-20) : l'ordre est la date
 * d'INSERTION (created_at), pas la date de l'event — le bloc « fraîcheur »
 * qui donne une raison de revenir. Cached anon (public, tag events).
 */
export const getRecentlyAddedEvents = unstable_cache(
  async (limit = 8) => {
    const supabase = createAnonClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { data, error } = await supabase
      .from('events')
      .select(`${EVENT_SELECT}, created_at`)
      // mv/release seulement : les épisodes music-show arrivent par lot
      // quotidien (bruit), les anniversaires ne sont pas des annonces.
      .in('type', ['mv', 'release'])
      .eq('hidden', false)
      .gte('start_at', new Date().toISOString())
      .or(isMainOrNonMv)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data ?? []
  },
  ['recently-added-events'],
  { revalidate: 900, tags: ['events'] },
)

/**
 * Date de la DERNIÈRE sortie (mv/release) par groupe, toutes périodes — base du
 * statut d'activité (actif / en pause / dormant, cf. lib/groups/activity.ts).
 * Cached anon : identique pour tous les viewers, tag `events`.
 */
const getLastReleasePairsCached = unstable_cache(
  async (): Promise<[string, string][]> => {
    const supabase = createAnonClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const out = new Map<string, string>()
    // Paginé : le catalogue dépasse largement le plafond PostgREST de 1000.
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from('events')
        .select('group_id, start_at')
        .in('type', ['mv', 'release'])
        .eq('hidden', false)
        // Même prédicat de visibilité que partout ailleurs (§8 SCRAPING.md) :
        // sans lui, une version `other_version` — invisible sur toute autre
        // surface — passait pour la dernière sortie du groupe et le faisait
        // paraître actif. Candy Shop était crédité d'une sortie de mars 2026
        // que personne ne peut voir, au lieu d'un badge « En pause ».
        .or(isMainOrNonMv)
        .lte('start_at', new Date().toISOString())
        .order('start_at', { ascending: false })
        .range(from, from + 999)
      if (error) break
      for (const e of data ?? []) {
        if (e.group_id && !out.has(e.group_id)) out.set(e.group_id, e.start_at)
      }
      if (!data || data.length < 1000) break
    }
    return [...out]
  },
  ['last-release-by-group'],
  { revalidate: 3600, tags: ['events'] },
)

/**
 * Dernière sortie visible d'UN groupe — pour la page groupe.
 *
 * `getLastReleaseByGroupCached` construit la Map des 262 groupes en paginant
 * les 3 139 lignes mv/release : 4 allers-retours PostgREST séquentiels, pour
 * une page qui lit UNE entrée. Correct pour /groups (qui les lit toutes),
 * absurde ici — et à froid c'est du TTFB en plus sur une page détail.
 *
 * Même prédicat de visibilité que la Map, sinon la page et le badge
 * d'activité de /groups se contrediraient.
 */
export async function getLastReleaseForGroup(groupId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('events')
    .select('start_at')
    .eq('group_id', groupId)
    .in('type', ['mv', 'release'])
    .eq('hidden', false)
    .or(isMainOrNonMv)
    .lte('start_at', new Date().toISOString())
    .order('start_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data?.start_at ?? null
}

export async function getLastReleaseByGroupCached(): Promise<Map<string, string>> {
  return new Map(await getLastReleasePairsCached())
}

export type UpcomingEvent = Awaited<ReturnType<typeof getUpcomingEvents>>[number]
export type RecentComeback = Awaited<ReturnType<typeof getRecentComebacks>>[number]
export type MvEvent = Awaited<ReturnType<typeof getGroupMvs>>['rows'][number]

/** MVs likés par un user (table mv_like), du plus récent au plus ancien. */
export async function getLikedMvs(userId: string, limit = 30): Promise<MvEvent[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mv_like')
    .select(`created_at, event:events!inner(${MV_SELECT})`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((r) => (r as unknown as { event: MvEvent }).event)
}

/**
 * Entités les plus récemment commentées (format "forum-like", §7.2), triées par
 * date du dernier commentaire, avec le nombre de commentaires. Agrégation JS
 * bornée (fenêtre des 300 derniers commentaires) — suffisant pour une sidebar et
 * évite un RPC dédié. Les commentaires vivent sur les pages MV → liens internes.
 */
export async function getRecentlyCommentedEvents(limit = 12) {
  const supabase = await createClient()
  const { data: recent, error } = await supabase
    .from('comments')
    .select('event_id, created_at')
    // Les commentaires d'ÉPISODE (episode_id, Lot N) ont event_id null — la
    // sidebar Recent discussions reste orientée MV/events.
    .not('event_id', 'is', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(300)
  if (error) throw error

  // Ordre desc déjà appliqué → la 1re occurrence d'un event = son dernier commentaire.
  const lastByEvent = new Map<string, string>()
  for (const c of recent ?? []) {
    if (c.event_id && !lastByEvent.has(c.event_id)) lastByEvent.set(c.event_id, c.created_at)
  }
  const ids = [...lastByEvent.keys()].slice(0, limit)
  if (ids.length === 0) return []

  const [eventsRes, countsRes] = await Promise.all([
    supabase
      .from('events')
      .select('id, slug, title, type, image_url, source_url, groups!inner(slug, artist_slug, name)')
      .in('id', ids)
      .eq('hidden', false),
    supabase.from('comments').select('event_id').is('deleted_at', null).in('event_id', ids),
  ])
  const countByEvent = new Map<string, number>()
  for (const r of countsRes.data ?? []) {
    if (r.event_id) countByEvent.set(r.event_id, (countByEvent.get(r.event_id) ?? 0) + 1)
  }
  const eventById = new Map((eventsRes.data ?? []).map((e) => [e.id, e]))

  return ids.flatMap((id) => {
    const e = eventById.get(id)
    if (!e) return []
    return [{ ...e, commentCount: countByEvent.get(id) ?? 0, lastCommentAt: lastByEvent.get(id)! }]
  })
}

export type CommentedEvent = Awaited<ReturnType<typeof getRecentlyCommentedEvents>>[number]
