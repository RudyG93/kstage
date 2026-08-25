/**
 * Reconstruction des épisodes music-show À PARTIR DE CE QUI A ÉTÉ DIFFUSÉ
 * (round 2026-08-21) — pendant « aval » de `mv-recovery` pour les MV.
 *
 * Le pipeline historique part d'un lineup PRÉVISIONNEL (carrd fan, boards
 * broadcaster) capté dans une fenêtre étroite : ce qui est raté est perdu,
 * ce qui change n'est jamais repris. Ici on part de la seule source qui ne
 * ment pas — la vidéo postée par le diffuseur — et on l'utilise pour :
 *   1. créer l'ÉPISODE manquant (régularité) ;
 *   2. renseigner son NUMÉRO quand le diffuseur l'annonce (Mnet, Show Champion) ;
 *   3. créer les PASSAGES absents du lineup prévisionnel ;
 *   4. poser `stage_url` dans la foulée, sans dépendre de la date de publication.
 *
 * Garde-fous (rien n'est deviné) :
 *   — une vidéo ne compte que si son titre porte le marqueur du show ET une
 *     date de diffusion explicite tombant le bon jour de la semaine ;
 *   — le nom d'artiste est matché par MOTS ENTIERS (`mentionsArtist`) : une
 *     inclusion de sous-chaîne inventerait des passages (« LIVE » → IVE) ;
 *   — un nom qui désigne plusieurs groupes du roster est ignoré, pas arbitré ;
 *   — les segments MC / teasers / compilations ne prouvent pas un passage.
 */

import type { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { fetchUploadsPage, fetchVideoDetails, resolveChannel, type UploadItem } from '../youtube'
import { needleInTitle, normalize, tokenIndex } from '../group-match'
import {
  MIN_STAGE_DURATION_SEC,
  STAGE_CHANNELS,
  STAGE_TITLE_MARKERS,
  stageScore,
} from './stage-links'
import { harvestEpisodes, type HarvestedEpisode } from './broadcast-harvest'
import { kstDateTimeToIso } from './slots'
import { SHOW_DESCRIPTORS, type ShowId } from './types'
import { SOURCE_URL } from './sources/live-show-updates'

type SupabaseClient = ReturnType<typeof createClient<Database>>

/** Écritures où deux caractères portent assez d'information pour discriminer. */
const CJK_RE = /[\p{Script=Hangul}\p{Script=Han}\p{Script=Katakana}\p{Script=Hiragana}]/u

/**
 * Contenus qui citent un artiste SANS qu'il soit passé sur scène : segment MC
 * (« [MC TALK] special MC xikers YUJUN » — les MC ne sont pas au programme),
 * annonces de lineup, teasers, compilations d'archives. Exclus de la preuve de
 * passage ; le scoring de `stage_url` les écarte déjà par ailleurs.
 */
const NOT_A_PERFORMANCE_RE =
  /mc\s*석|mc\s*talk|스페셜\s*mc|special\s*mc|예고|티저|teaser|라인업|line\s?-?up|모음|\.zip\b|미리보기|엠카드림/i

export interface AiredScanOptions {
  shows?: readonly ShowId[]
  /** Pages d'uploads par chaîne (50/page). 4 en routine, ~40 en backfill. */
  maxPages?: number
  /** Jour KST le plus ancien traité. Défaut : J-28. */
  sinceKstDay?: string
  /** false = analyse seule, aucune écriture (revue avant application). */
  apply?: boolean
}

export interface AiredShowStats {
  episodes: number
  episodesCreated: number
  numbersFilled: number
  eventsCreated: number
  stagesLinked: number
  /** Passages sans `stage_url` rencontrés, et ceux pour qui un candidat existe. */
  stagePending: number
  stageCandidates: number
  /** Passages en base qu'AUCUNE vidéo de l'épisode ne confirme. */
  unconfirmed: string[]
  /** Rows dont `lineup_state` a changé ce run (aired ou unconfirmed). */
  stateChanged: number
}

export interface AiredScanResult {
  units: number
  byShow: Record<string, AiredShowStats>
  episodesCreated: number
  numbersFilled: number
  eventsCreated: number
  stagesLinked: number
  numbersSynced: number
  created: string[]
  unconfirmed: string[]
  errors: string[]
}

interface RosterIndex {
  /** Nom normalisé (groupe, alias, ou membre solo) → group_id, null si ambigu. */
  byNeedle: Map<string, string | null>
  nameById: Map<string, string>
  aliasesById: Map<string, readonly string[]>
}

/** Charge une table en pages de 1 000 (plafond serveur PostgREST). */
async function fetchAll<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null }>,
): Promise<T[]> {
  const out: T[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data } = await query(from, from + PAGE - 1)
    if (!data || data.length === 0) break
    out.push(...data)
    if (data.length < PAGE) break
  }
  return out
}

export async function buildRosterIndex(supabase: SupabaseClient): Promise<RosterIndex> {
  const groups = await fetchAll<{
    id: string
    name: string
    slug: string
    name_aliases: string[] | null
  }>((from, to) => supabase.from('groups').select('id, name, slug, name_aliases').range(from, to))

  const byNeedle = new Map<string, string | null>()
  const nameById = new Map<string, string>()
  const aliasesById = new Map<string, readonly string[]>()
  const add = (raw: string, groupId: string) => {
    const key = normalize(raw)
    // Longueur minimale dépendante de l'écriture : deux lettres latines ne
    // discriminent rien, deux syllabes hangul si (« 연준 » = YEONJUN, « 선미 »
    // = SUNMI). Le seuil unique à 3 les jetait toutes : TXT restait invisible
    // sur 7 épisodes où KBS/SBS titrent son slot solo « 연준 » (2026-08-21).
    if (key.length < (CJK_RE.test(key) ? 2 : 3)) return
    const cur = byNeedle.get(key)
    byNeedle.set(key, cur === undefined || cur === groupId ? groupId : null)
  }
  for (const g of groups) {
    nameById.set(g.id, g.name)
    aliasesById.set(g.id, g.name_aliases ?? [])
    add(g.name, g.id)
    add(g.slug, g.id)
    for (const a of g.name_aliases ?? []) add(a, g.id)
  }

  // PAS de noms de MEMBRES ici, contrairement au cron lineups. Là-bas l'entrée
  // est un nom d'artiste déjà isolé (« KIHYUN (MONSTA X) ») ; ici c'est un
  // titre de vidéo libre, où un prénom de scène capte n'importe quoi. Mesuré
  // sur The Show le 2026-08-21, tous des passages INVENTÉS :
  //   « fan » (membre de NouerA)  ← « [FAN PICK CAM 4K] … »
  //   « jin » (BTS)               ← « … 강우진 (KANG WOO JIN) … »
  //   « kim » (VVUP)              ← « ARTMS - Kim Lip … »
  //   « junmin » (xikers)         ← « WHIB 김준민(KIM JUNMIN) … »
  // Le nom du GROUPE figure de toute façon dans ces titres : l'index membres
  // n'apportait que de la redondance et ces quatre fabrications.
  return { byNeedle, nameById, aliasesById }
}

/** group_id des artistes cités par ce titre (mots entiers, sans ambiguïté). */
export function groupsInTitle(title: string, roster: RosterIndex): string[] {
  const index = tokenIndex(title)
  const hits = new Set<string>()
  for (const [needle, id] of roster.byNeedle) {
    if (id && needleInTitle(needle, index)) hits.add(id)
  }
  return [...hits]
}

const KST_DAY_MS = 86_400_000

function kstToday(nowMs: number): string {
  return new Date(nowMs + 9 * 3600_000).toISOString().slice(0, 10)
}

function dayBounds(kstDay: string): { from: string; to: string } {
  const from = new Date(`${kstDay}T00:00:00+09:00`)
  return { from: from.toISOString(), to: new Date(from.getTime() + KST_DAY_MS).toISOString() }
}

/** ISO UTC du créneau officiel du show pour ce jour KST. */
function slotIso(showId: ShowId, kstDay: string): string {
  const desc = SHOW_DESCRIPTORS.find((s) => s.id === showId)!
  const [y, m, d] = kstDay.split('-').map(Number)
  return kstDateTimeToIso(y, m, d, desc.slot.hour, desc.slot.minute) ?? `${kstDay}T00:00:00Z`
}

export async function scanAiredShows(
  supabase: SupabaseClient,
  apiKey: string,
  opts: AiredScanOptions = {},
): Promise<AiredScanResult> {
  const nowMs = Date.now()
  const today = kstToday(nowMs)
  const since = opts.sinceKstDay ?? kstToday(nowMs - 28 * KST_DAY_MS)
  const maxPages = opts.maxPages ?? 4
  const apply = opts.apply ?? true
  const shows = opts.shows ?? SHOW_DESCRIPTORS.map((s) => s.id)

  const roster = await buildRosterIndex(supabase)
  const result: AiredScanResult = {
    units: 0,
    byShow: {},
    episodesCreated: 0,
    numbersFilled: 0,
    eventsCreated: 0,
    stagesLinked: 0,
    numbersSynced: 0,
    created: [],
    unconfirmed: [],
    errors: [],
  }

  for (const showId of shows) {
    const desc = SHOW_DESCRIPTORS.find((s) => s.id === showId)!
    const stats: AiredShowStats = {
      episodes: 0,
      episodesCreated: 0,
      numbersFilled: 0,
      stateChanged: 0,
      eventsCreated: 0,
      stagesLinked: 0,
      stagePending: 0,
      stageCandidates: 0,
      unconfirmed: [],
    }
    result.byShow[showId] = stats

    let uploads: UploadItem[]
    try {
      result.units++
      const channel = await resolveChannel(STAGE_CHANNELS[showId], apiKey)
      uploads = []
      let pageToken: string | undefined
      // Early-stop : inutile de descendre sous la borne (les vidéos sont
      // publiées APRÈS la diffusion, avec 3 jours de marge de sécurité).
      const floorMs = Date.parse(`${since}T00:00:00+09:00`) - 3 * KST_DAY_MS
      for (let page = 0; page < maxPages; page++) {
        result.units++
        const res = await fetchUploadsPage(channel.uploadsPlaylistId, apiKey, pageToken)
        uploads.push(...res.items)
        const last = res.items[res.items.length - 1]
        if (last && Date.parse(last.publishedAt) < floorMs) break
        if (!res.nextPageToken) break
        pageToken = res.nextPageToken
      }
    } catch (e) {
      result.errors.push(`${showId}: ${e instanceof Error ? e.message : String(e)}`)
      continue
    }

    const episodes = harvestEpisodes(uploads, showId, STAGE_TITLE_MARKERS[showId]).filter(
      (ep) => ep.kstDay >= since && ep.kstDay <= today,
    )
    stats.episodes = episodes.length

    for (const ep of episodes) {
      await applyEpisode(supabase, apiKey, {
        showId,
        showTitle: desc.displayName,
        episode: ep,
        roster,
        apply,
        stats,
        result,
      })
    }

    result.episodesCreated += stats.episodesCreated
    result.numbersFilled += stats.numbersFilled
    result.eventsCreated += stats.eventsCreated
    result.stagesLinked += stats.stagesLinked
    result.unconfirmed.push(...stats.unconfirmed)
  }

  if (apply) result.numbersSynced = await syncEventEpisodeNumbers(supabase, since)

  return result
}

/**
 * Aligne `events.episode_number` sur `show_episodes` — seule autorité du numéro.
 *
 * Les deux étaient renseignés indépendamment, chacun à la merci de ce que la
 * source du jour portait : mesuré le 2026-08-21, Music Bank du 21/08 affichait
 * « #1304 » sur 5 tuiles et rien sur 2 autres, et The Show du 14/07 portait
 * DEUX numéros différents pour le même épisode. Le numéro est une propriété
 * de l'épisode, pas du passage : il se recopie, il ne se redécouvre pas.
 */
export async function syncEventEpisodeNumbers(
  supabase: SupabaseClient,
  sinceKstDay: string,
): Promise<number> {
  const { data: episodes } = await supabase
    .from('show_episodes')
    .select('show_title, kst_day, episode_number')
    .not('episode_number', 'is', null)
    .gte('kst_day', sinceKstDay)
  let synced = 0
  for (const ep of episodes ?? []) {
    const { from, to } = dayBounds(ep.kst_day)
    const { data: stale } = await supabase
      .from('events')
      .select('id')
      .eq('type', 'music_show')
      .eq('title', ep.show_title)
      .gte('start_at', from)
      .lt('start_at', to)
      .or(`episode_number.is.null,episode_number.neq.${ep.episode_number}`)
    if (!stale || stale.length === 0) continue
    const { error } = await supabase
      .from('events')
      .update({ episode_number: ep.episode_number })
      .in(
        'id',
        stale.map((r) => r.id),
      )
    if (!error) synced += stale.length
  }
  return synced
}

async function applyEpisode(
  supabase: SupabaseClient,
  apiKey: string,
  ctx: {
    showId: ShowId
    showTitle: string
    episode: HarvestedEpisode
    roster: RosterIndex
    apply: boolean
    stats: AiredShowStats
    result: AiredScanResult
  },
): Promise<void> {
  const { showId, showTitle, episode, roster, apply, stats, result } = ctx
  const { kstDay, episodeNumber, videos } = episode

  // 1. Épisode : créer la row si absente, ne combler le numéro que s'il est
  // null (une valeur existante fait autorité — leçon carrd décalé 2026-07-18).
  const { data: existingEp } = await supabase
    .from('show_episodes')
    .select('id, episode_number')
    .eq('show_title', showTitle)
    .eq('kst_day', kstDay)
    .maybeSingle()

  if (!existingEp) {
    stats.episodesCreated++
    result.created.push(
      `épisode ${showTitle} ${kstDay}${episodeNumber ? ` #${episodeNumber}` : ''}`,
    )
    if (apply) {
      await supabase.from('show_episodes').upsert(
        {
          show_title: showTitle,
          kst_day: kstDay,
          start_at: slotIso(showId, kstDay),
          ...(episodeNumber != null ? { episode_number: episodeNumber } : {}),
        },
        { onConflict: 'show_title,kst_day' },
      )
    }
  } else if (existingEp.episode_number == null && episodeNumber != null) {
    stats.numbersFilled++
    result.created.push(`numéro ${showTitle} ${kstDay} → #${episodeNumber}`)
    if (apply) {
      await supabase
        .from('show_episodes')
        .update({ episode_number: episodeNumber })
        .eq('id', existingEp.id)
    }
  }

  // 2. Présence : quels groupes du roster ces vidéos prouvent-elles ?
  const performances = videos.filter((v) => !NOT_A_PERFORMANCE_RE.test(v.title))
  const videosByGroup = new Map<string, UploadItem[]>()
  // `proofByGroup` ⊂ `videosByGroup` : uniquement les vidéos qui ne nomment
  // QU'UN artiste du roster. Un titre qui en cite deux ne dit pas lequel est
  // passé — le titre de chanson peut être un nom de groupe (« hrtz.wav -
  // Highlight » créait un passage du groupe Highlight). Seule cette preuve
  // franche autorise une CRÉATION ; le reste sert au classement des scènes.
  const proofByGroup = new Map<string, UploadItem[]>()
  for (const v of performances) {
    const gids = groupsInTitle(v.title, roster)
    for (const gid of gids) {
      videosByGroup.set(gid, [...(videosByGroup.get(gid) ?? []), v])
      if (gids.length === 1) proofByGroup.set(gid, [...(proofByGroup.get(gid) ?? []), v])
    }
  }

  const { from, to } = dayBounds(kstDay)
  const { data: existingRows } = await supabase
    .from('events')
    .select('id, group_id, stage_url, start_at, lineup_state')
    .eq('type', 'music_show')
    .eq('title', showTitle)
    .gte('start_at', from)
    .lt('start_at', to)
  const existing = existingRows ?? []
  const existingByGroup = new Map(existing.map((e) => [e.group_id, e]))

  // 3. Passages absents du lineup prévisionnel : la vidéo prouve la diffusion.
  const startAt = existing[0]?.start_at ?? slotIso(showId, kstDay)
  for (const [groupId, proof] of proofByGroup) {
    if (existingByGroup.has(groupId)) continue
    result.created.push(
      `passage ${showTitle} ${kstDay} — ${roster.nameById.get(groupId)} ×${proof.length}  ←  ${proof[0].title}`,
    )
    if (!apply) {
      stats.eventsCreated++
      continue
    }
    const { data: inserted, error } = await supabase
      .from('events')
      .insert({
        group_id: groupId,
        // source_url RESTE la clé d'idempotence commune des music_show : le
        // scraper de lineups doit reconnaître cette row comme la sienne,
        // sinon il en réinsère une seconde au prochain passage.
        source_url: SOURCE_URL,
        type: 'music_show',
        title: showTitle,
        start_at: startAt,
        status: 'confirmed',
        // Créé PARCE QU'une vidéo du diffuseur nomme ce groupe sur cet
        // épisode : c'est un passage prouvé, pas une annonce.
        lineup_state: 'aired',
        ...(episodeNumber != null ? { episode_number: episodeNumber } : {}),
      })
      .select('id, group_id, stage_url, start_at, lineup_state')
      .maybeSingle()
    if (error) {
      result.errors.push(`insert ${showTitle} ${kstDay}: ${error.message}`)
      continue
    }
    stats.eventsCreated++
    if (inserted) existingByGroup.set(groupId, inserted)
  }

  // 4. stage_url : meilleur candidat DANS l'épisode (plus aucune fenêtre de
  // publication à respecter — l'appartenance est prouvée par la date du titre).
  const allNames = [...videosByGroup.keys()].map((id) => roster.nameById.get(id) ?? '')
  const ranked = new Map<string, UploadItem[]>()
  const idsToCheck = new Set<string>()
  for (const [groupId, event] of existingByGroup) {
    if (event.stage_url) continue
    stats.stagePending++
    const name = roster.nameById.get(groupId)
    if (!name) continue
    const aliases = roster.aliasesById.get(groupId) ?? []
    const scored = (videosByGroup.get(groupId) ?? [])
      .map((u) => ({ u, s: stageScore(u.title, name, allNames, aliases, true) ?? -99 }))
      // Seuil 0, pas MIN_STAGE_SCORE : ce dernier compense l'incertitude
      // d'appartenance de l'ancien chemin (fenêtre de publication floue). Ici
      // la date de diffusion est LUE dans le titre — il ne reste au score qu'à
      // classer et à écarter les dérivés (fancam, interview, #shorts, collab
      // multi-artistes), tous négatifs. Sans ça les scènes d'Inkigayo
      // (« [안방1열 풀캠4K] 파우 'Flavor' (POW FullCam) @SBS Inkigayo 260816 »,
      // score 0 : ni « 방송 » ni séparateur) étaient toutes rejetées.
      .filter((c) => c.s >= 0)
      .sort((a, b) => b.s - a.s || Date.parse(a.u.publishedAt) - Date.parse(b.u.publishedAt))
      .slice(0, 3)
      .map((c) => c.u)
    if (scored.length === 0) continue
    stats.stageCandidates++
    ranked.set(groupId, scored)
    for (const c of scored) idsToCheck.add(c.videoId)
  }

  if (idsToCheck.size > 0) {
    try {
      const { details, calls } = await fetchVideoDetails([...idsToCheck], apiKey)
      result.units += calls
      for (const [groupId, candidates] of ranked) {
        const hit = candidates.find((c) => {
          const d = details.get(c.videoId)
          return d?.durationSec != null && d.durationSec >= MIN_STAGE_DURATION_SEC
        })
        if (!hit) continue
        const event = existingByGroup.get(groupId)!
        if (!apply) {
          stats.stagesLinked++
          continue
        }
        const { error } = await supabase
          .from('events')
          .update({
            stage_url: `https://www.youtube.com/watch?v=${hit.videoId}`,
            image_url: hit.thumbnailUrl,
          })
          .eq('id', event.id)
        if (error) result.errors.push(`stage ${showTitle} ${kstDay}: ${error.message}`)
        else stats.stagesLinked++
      }
    } catch (e) {
      result.errors.push(`videos.list ${showId}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // 5. État de chaque passage de l'épisode : `aired` si une vidéo du diffuseur
  // nomme le groupe, `unconfirmed` sinon. La preuve est `videosByGroup`, PAS
  // `stage_url` — sur 30 jours, 39 passages n'ont pas de `stage_url` mais
  // seulement 30 n'ont aucune vidéo : les 9 autres sont bien passés, leur
  // vidéo n'a simplement pas franchi le scoring ou la durée.
  //
  // Seuls les épisodes BIEN COUVERTS sont concluants : un diffuseur ne poste
  // pas toujours toutes ses scènes, et sur un épisode mal moissonné l'absence
  // de vidéo ne prouve rien. En dessous du seuil on ne touche à rien — les
  // rows gardent leur état précédent plutôt que d'être dégradées à tort.
  // (M Countdown EP.941 du 13/08 : 22 vidéos, spécial « Summer Camp » — 9 des
  // 10 groupes annoncés n'y sont jamais passés.)
  const wellCovered = videos.length >= 8 && videosByGroup.size >= 3
  if (!wellCovered) return

  const parEtat: Record<'aired' | 'unconfirmed', string[]> = { aired: [], unconfirmed: [] }
  for (const [groupId, event] of existingByGroup) {
    const etat = videosByGroup.has(groupId) ? 'aired' : 'unconfirmed'
    if (etat === 'unconfirmed')
      stats.unconfirmed.push(`${showTitle} ${kstDay} — ${roster.nameById.get(groupId) ?? groupId}`)
    if (event.lineup_state !== etat) parEtat[etat].push(event.id)
  }
  stats.stateChanged = parEtat.aired.length + parEtat.unconfirmed.length
  if (!apply) return
  for (const etat of ['aired', 'unconfirmed'] as const) {
    if (parEtat[etat].length === 0) continue
    const { error } = await supabase
      .from('events')
      .update({ lineup_state: etat })
      .in('id', parEtat[etat])
    if (error) result.errors.push(`lineup_state ${etat} ${showTitle} ${kstDay}: ${error.message}`)
  }
}
