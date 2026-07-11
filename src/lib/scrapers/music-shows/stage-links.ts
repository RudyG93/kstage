import type { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  resolveChannel,
  fetchUploadsPage,
  fetchVideoDetails,
  type UploadItem,
  type VideoDetails,
} from '../youtube'
import { matchesGroup } from '../group-match'
import { SHOW_DESCRIPTORS, type ShowId } from './types'

type SupabaseClient = ReturnType<typeof createClient<Database>>

// Enrichissement « stage links » (demande Rudy 2026-07-03) : après diffusion,
// les chaînes officielles des diffuseurs postent la vidéo du passage de chaque
// groupe. On écrit l'URL de cette vidéo dans `stage_url` (colonne dédiée,
// migration 0039) → `eventHref` route alors le bandeau vers YouTube.
// ⚠️ Ne JAMAIS écrire dans `source_url` : il fait partie de la clé
// d'idempotence du scraper (group_id, type, start_at, source_url) — le muter
// faisait réinsérer une row doublon à chaque re-scrape (SCRAPING.md §3.14,
// 14 paires en prod avant le fix).
//
// Chaînes VÉRIFIÉES via channels.list/forHandle le 2026-07-03 (règle : jamais
// de handle deviné — cf. reference_youtube_handle_verification) :
//   @KBSKpop 10.3M · @MBCkpop 11.5M · @sbskpop 8.7M · @Mnet 22.5M ·
//   @ALLTHEKPOP 6.9M (MBC M / Show Champion) · @thekpop 2.9M (SBS M / The Show)
export const STAGE_CHANNELS: Record<ShowId, string> = {
  'music-bank': 'https://www.youtube.com/@KBSKpop',
  'music-core': 'https://www.youtube.com/@MBCkpop',
  inkigayo: 'https://www.youtube.com/@sbskpop',
  'm-countdown': 'https://www.youtube.com/@Mnet',
  'show-champion': 'https://www.youtube.com/@ALLTHEKPOP',
  'the-show': 'https://www.youtube.com/@thekpop',
}

// Le titre d'une vidéo de passage porte toujours le nom du show (EN ou KR).
// Garde contre les autres contenus des mêmes chaînes (variety, interviews
// d'autres émissions).
export const STAGE_TITLE_MARKERS: Record<ShowId, RegExp> = {
  'music-bank': /music ?bank|뮤직뱅크/i,
  'music-core': /music ?core|음악중심|쇼! 음악중심/i,
  inkigayo: /inkigayo|인기가요/i,
  'm-countdown': /m ?countdown|엠카운트다운/i,
  'show-champion': /show ?champion|쇼챔피언/i,
  'the-show': /the ?show|더쇼/i,
}

const DISPLAY_TO_ID = new Map<string, ShowId>(SHOW_DESCRIPTORS.map((s) => [s.displayName, s.id]))

/** displayName DB (« Music Bank ») → ShowId (« music-bank »). */
export function showIdFromTitle(title: string): ShowId | null {
  return DISPLAY_TO_ID.get(title) ?? null
}

// Fenêtre de publication acceptée autour de la diffusion : les stages sortent
// entre l'heure H (clips quasi-live) et quelques jours après.
const BEFORE_MS = 12 * 60 * 60 * 1000
const AFTER_MS = 4 * 24 * 60 * 60 * 1000

// Une vraie perf dure ≥ 60 s ; les clips dérivés des mêmes chaînes (Shorts,
// réactions) sont plus courts. Validé par videos.list avant écriture.
export const MIN_STAGE_DURATION_SEC = 60

// Score minimal pour lier : mieux vaut le repli page-groupe qu'un lien vers un
// segment variety ou une caption Shorts (2 faux positifs réels aux runs 1-2).
export const MIN_STAGE_SCORE = 1

/**
 * Candidats « vidéo du passage » d'un groupe, du plus probable au moins
 * probable : marqueur du show + nom du groupe (hors hashtags) + fenêtre
 * [H-12h, H+4j], puis scoring —
 *   +2 marqueur de diffusion (« 방송 », « EP.935 », « 무대 ») : signe le stage
 *   +1 format « Song - Group » / séparateur « | »
 *   −3 titre qui matche AUSSI d'autres groupes (segments variety multi-artistes,
 *      faux positif réel « M-Z » Mnet au run 2 — un vrai stage n'a qu'un artiste)
 *   −5 #shorts
 * Seuls les candidats ≥ MIN_STAGE_SCORE sont renvoyés. Pur, testable.
 */
export function rankStageCandidates(
  uploads: readonly UploadItem[],
  groupName: string,
  showId: ShowId,
  eventStartAtIso: string,
  otherGroupNames: readonly string[] = [],
): UploadItem[] {
  const marker = STAGE_TITLE_MARKERS[showId]
  const airTime = new Date(eventStartAtIso).getTime()
  const scored: { upload: UploadItem; score: number; published: number }[] = []
  for (const u of uploads) {
    if (!marker.test(u.title)) continue
    if (!matchesGroup(u.title, groupName)) continue
    const published = new Date(u.publishedAt).getTime()
    if (Number.isNaN(published)) continue
    if (published < airTime - BEFORE_MS || published > airTime + AFTER_MS) continue
    let score = 0
    if (/방송|무대|\bep\.?\s*\d+/i.test(u.title)) score += 2
    if (/\s[-|]\s/.test(u.title)) score += 1
    if (otherGroupNames.some((other) => other !== groupName && matchesGroup(u.title, other)))
      score -= 3
    if (/#shorts/i.test(u.title)) score -= 5
    // Contenus NON-stage des mêmes chaînes : interview, making, behind,
    // fancam/selfcam, réaction… Faux positif réel du 2026-07-09 : « '컴백
    // 인터뷰' i-dle #엠카운트다운 EP.936 | Mnet 방송 » scorait +3 (EP+방송 et
    // « | ») et a été lié comme stage. Un vrai passage ne porte aucun de ces
    // marqueurs ; -5 les élimine quel que soit le reste du titre.
    if (
      /인터뷰|interview|비하인드|behind|메이킹|making|리액션|reaction|백스테이지|backstage|셀프캠|self\s?-?cam|직캠|fan\s?-?cam|\btmi\b|소감/i.test(
        u.title,
      )
    )
      score -= 5
    if (score < MIN_STAGE_SCORE) continue
    scored.push({ upload: u, score, published })
  }
  return scored.sort((a, b) => b.score - a.score || a.published - b.published).map((s) => s.upload)
}

export interface StageLinkResult {
  scanned: number
  linked: number
  units: number
  byShow: Record<string, { pending: number; linked: number }>
}

/**
 * Enrichit les events music_show récents (10 jours) encore liés au carrd avec
 * la vidéo YouTube du passage. Quota : ~3 units par show actif (1 channels.list
 * + 2 playlistItems), seulement pour les shows ayant des events en attente.
 */
export async function enrichStageLinks(
  supabase: SupabaseClient,
  apiKey: string,
): Promise<StageLinkResult> {
  const since = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
  const now = new Date().toISOString()
  const { data: pending } = await supabase
    .from('events')
    .select('id, title, start_at, stage_url, groups!inner(name)')
    .eq('type', 'music_show')
    .gte('start_at', since)
    .lte('start_at', now)
    // « pas encore enrichi » = stage_url absent (source_url n'est plus touché).
    .is('stage_url', null)
    .order('start_at', { ascending: false })

  const result: StageLinkResult = { scanned: 0, linked: 0, units: 0, byShow: {} }
  const events = pending ?? []
  if (events.length === 0) return result

  // Regroupe par show : un seul fetch d'uploads par chaîne.
  const byShow = new Map<ShowId, typeof events>()
  for (const e of events) {
    const showId = showIdFromTitle(e.title)
    if (!showId) continue
    const list = byShow.get(showId) ?? []
    list.push(e)
    byShow.set(showId, list)
  }

  for (const [showId, showEvents] of byShow) {
    const stats = (result.byShow[showId] = { pending: showEvents.length, linked: 0 })
    let uploads: UploadItem[]
    try {
      result.units++
      const channel = await resolveChannel(STAGE_CHANNELS[showId], apiKey)
      uploads = []
      let pageToken: string | undefined
      // 2 pages = 100 uploads récents — ces chaînes postent ~20-40 vidéos/jour,
      // ça couvre largement la fenêtre de 4 jours des events en attente.
      for (let page = 0; page < 2; page++) {
        result.units++
        const res = await fetchUploadsPage(channel.uploadsPlaylistId, apiKey, pageToken)
        uploads.push(...res.items)
        if (!res.nextPageToken) break
        pageToken = res.nextPageToken
      }
    } catch (e) {
      console.error(`[stage-links] ${showId}: ${e instanceof Error ? e.message : e}`)
      continue
    }

    // Candidats classés par event, puis validation de DURÉE en un videos.list
    // batché (les clips dérivés type Shorts font < 60 s — faux positif du run 1).
    const candidatesByEvent = new Map<string, UploadItem[]>()
    const allIds = new Set<string>()
    // Les autres groupes du même show servent au malus multi-artistes.
    const allGroupNames = showEvents.flatMap((e) => (e.groups?.name ? [e.groups.name] : []))
    for (const event of showEvents) {
      result.scanned++
      const groupName = event.groups?.name
      if (!groupName) continue
      const ranked = rankStageCandidates(
        uploads,
        groupName,
        showId,
        event.start_at,
        allGroupNames,
      ).slice(0, 3)
      if (ranked.length === 0) continue
      candidatesByEvent.set(event.id, ranked)
      for (const c of ranked) allIds.add(c.videoId)
    }
    if (candidatesByEvent.size === 0) continue

    let durations: Map<string, VideoDetails>
    try {
      const res = await fetchVideoDetails([...allIds], apiKey)
      durations = res.details
      result.units += res.calls
    } catch (e) {
      console.error(`[stage-links] videos.list ${showId}: ${e instanceof Error ? e.message : e}`)
      continue
    }

    for (const event of showEvents) {
      const ranked = candidatesByEvent.get(event.id)
      if (!ranked) continue
      const hit = ranked.find((c) => {
        const d = durations.get(c.videoId)
        return d?.durationSec != null && d.durationSec >= MIN_STAGE_DURATION_SEC
      })
      if (!hit) continue
      const { error } = await supabase
        .from('events')
        .update({
          stage_url: `https://www.youtube.com/watch?v=${hit.videoId}`,
          image_url: hit.thumbnailUrl,
        })
        .eq('id', event.id)
      if (!error) {
        result.linked++
        stats.linked++
      }
    }
  }
  return result
}
