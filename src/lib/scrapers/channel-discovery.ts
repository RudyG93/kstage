// Découverte de chaînes hébergeant les MVs d'un groupe (Phase 3 Lot 3,
// audit §12 « découverte automatique des chaînes de labels » + « enrichissement
// des groupes récents pauvres en MVs »). Port en lib du one-shot
// scripts/discover-mv-channels.ts (qui devient un wrapper) pour le cron
// hebdo /api/cron/discover-channels.
//
// Méthode éprouvée « jamais de handle deviné » (R3-B) : search.list
// `"<nom>" MV` → ne retient que les vidéos dont le TITRE porte le groupe
// (matchesGroup, titre seul §3.10) ET un marqueur MV, hors dérivés
// (teaser/reaction/fancam…). Une chaîne est candidate au SEED AUTO si elle
// héberge ≥ 2 de ces MVs — 1 seul = signalé pour revue humaine, jamais seedé
// (garde-fou audit : ne jamais publier une identité ambiguë).
//
// Coût quota : ~100 unités par search.list → ~205/groupe (2 recherches +
// channels.list + backfill). Le cron borne à MAX_GROUPS_PER_RUN.

import type { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { matchesGroup } from './group-match'
import { scrapeGroup, QuotaExceededError } from './youtube'

type SupabaseClient = ReturnType<typeof createClient<Database>>

const MV_MARKER = /\bmv\b|\bm\/v\b|music video/i
const DERIVATIVE = /teaser|behind|reaction|cover|dance practice|live|fancam|직캠|리액션/i

export type SearchHit = {
  videoId: string
  title: string
  channelId: string
  channelTitle: string
  publishedAt?: string
}

/** Hits « vrais MVs du groupe » — pur, testable (title-match + marqueur MV + blacklist). */
export function filterMvSearchHits(hits: readonly SearchHit[], groupName: string): SearchHit[] {
  return hits.filter(
    (h) => matchesGroup(h.title, groupName) && MV_MARKER.test(h.title) && !DERIVATIVE.test(h.title),
  )
}

export type ChannelCandidate = {
  channelId: string
  channelTitle: string
  url: string
  hits: string[] // titres des MVs matchés
  subs: number | null
  // Date de publication la plus récente parmi les hits — sert la garde
  // anti-homonyme (round 2026-07-18 : « Our Birthday » AMV de 2025 seedé sur
  // le girl group OURBIRTHDAY né en 2026).
  latestHitAt: string | null
}

async function yt(path: string, params: Record<string, string>, apiKey: string) {
  const qs = new URLSearchParams({ ...params, key: apiKey })
  const r = await fetch(`https://www.googleapis.com/youtube/v3/${path}?${qs}`)
  if (r.status === 403) throw new QuotaExceededError()
  if (!r.ok) throw new Error(`${path} HTTP ${r.status}`)
  return r.json()
}

/**
 * Cherche les chaînes hébergeant les MVs du groupe. ~205 unités
 * (2 × search.list à 100 u + channels.list à ~1 u).
 */
export async function discoverChannelsForGroup(
  group: { name: string },
  apiKey: string,
): Promise<{ candidates: ChannelCandidate[]; units: number }> {
  let units = 0
  const byChannel = new Map<
    string,
    { channelTitle: string; hits: string[]; latestHitAt: string | null }
  >()
  for (const q of [`"${group.name}" MV`, `"${group.name}" official music video`]) {
    const d = await yt('search', { part: 'snippet', type: 'video', maxResults: '10', q }, apiKey)
    units += 100
    const hits: SearchHit[] = (d.items ?? []).map(
      (it: {
        id?: { videoId?: string }
        snippet: { title: string; channelId: string; channelTitle: string; publishedAt?: string }
      }) => ({
        videoId: it.id?.videoId ?? '',
        title: String(it.snippet.title),
        channelId: it.snippet.channelId,
        channelTitle: String(it.snippet.channelTitle),
        publishedAt: it.snippet.publishedAt,
      }),
    )
    for (const hit of filterMvSearchHits(hits, group.name)) {
      const c = byChannel.get(hit.channelId) ?? {
        channelTitle: hit.channelTitle,
        hits: [],
        latestHitAt: null,
      }
      if (!c.hits.includes(hit.title)) c.hits.push(hit.title)
      if (hit.publishedAt && (!c.latestHitAt || hit.publishedAt > c.latestHitAt)) {
        c.latestHitAt = hit.publishedAt
      }
      byChannel.set(hit.channelId, c)
    }
  }
  if (byChannel.size === 0) return { candidates: [], units }

  // Métadonnées (customUrl, subs) en un seul channels.list.
  const ids = [...byChannel.keys()].join(',')
  const ch = await yt('channels', { part: 'snippet,statistics', id: ids }, apiKey)
  units += 1
  const meta = new Map<string, { custom: string | null; subs: number | null }>(
    (ch.items ?? []).map(
      (it: {
        id: string
        snippet?: { customUrl?: string }
        statistics?: { subscriberCount?: string }
      }) => [
        it.id,
        {
          custom: it.snippet?.customUrl ?? null,
          subs: it.statistics?.subscriberCount ? Number(it.statistics.subscriberCount) : null,
        },
      ],
    ),
  )

  const candidates = [...byChannel.entries()]
    .map(([channelId, c]) => {
      const m = meta.get(channelId)
      return {
        channelId,
        channelTitle: c.channelTitle,
        url: m?.custom
          ? `https://www.youtube.com/${m.custom}`
          : `https://www.youtube.com/channel/${channelId}`,
        hits: c.hits,
        subs: m?.subs ?? null,
        latestHitAt: c.latestHitAt,
      }
    })
    .sort((a, b) => b.hits.length - a.hits.length)
  return { candidates, units }
}

export type SeedResult =
  | { seeded: true; sourceId: string; backfilled: number; promoted: boolean; units: number }
  | { seeded: false; reason: string }

/**
 * Seed auto d'une chaîne candidate (≥ 2 MVs title-matchés) + backfill des MVs
 * + promotion candidate → monitored. Idempotent : source déjà présente = skip.
 */
export async function seedAndBackfillChannel(
  supabase: SupabaseClient,
  group: { id: string; name: string; confidence: string; debut_date?: string | null },
  candidate: ChannelCandidate,
  apiKey: string,
): Promise<SeedResult> {
  // Garde-fou seed auto : 2 MVs minimum. 1 seul MV matché = signal faible
  // (compilation, chaîne fan) → revue humaine via scrape_log.details.review.
  if (candidate.hits.length < 2) {
    return { seeded: false, reason: `1 seul MV matché (${candidate.channelTitle})` }
  }
  // Garde anti-homonyme (round 2026-07-18) : si TOUS les hits datent d'avant
  // le debut du groupe (marge 180 j pour les pre-releases), la chaîne parle
  // d'autre chose — cas réel « Our Birthday » AMV 2025 seedé sur OURBIRTHDAY
  // (debut 2026-07-22).
  if (group.debut_date && candidate.latestHitAt) {
    const debutMs = Date.parse(group.debut_date)
    if (Date.parse(candidate.latestHitAt) < debutMs - 180 * 86_400_000) {
      return {
        seeded: false,
        reason: `hits antérieurs au debut (${candidate.latestHitAt.slice(0, 10)} < ${group.debut_date})`,
      }
    }
  }

  const { data: existing } = await supabase
    .from('sources')
    .select('id')
    .eq('group_id', group.id)
    .eq('url', candidate.url)
    .maybeSingle()
  if (existing) return { seeded: false, reason: 'source déjà présente' }

  const { data: source, error } = await supabase
    .from('sources')
    .insert({
      type: 'youtube_api',
      name: `${group.name} — ${candidate.channelTitle}`,
      url: candidate.url,
      channel_id: candidate.channelId,
      subscriber_count: candidate.subs,
      group_id: group.id,
    })
    .select('id, url, group_id')
    .single()
  if (error || !source) return { seeded: false, reason: `insert source: ${error?.message}` }

  // Promotion quarantaine → monitored : le groupe a désormais un canal MV
  // vérifié par les faits (≥ 2 MVs à son nom dessus). `verified` restera une
  // décision humaine/critères plus forts.
  let promoted = false
  if (group.confidence === 'candidate') {
    const { error: pErr } = await supabase
      .from('groups')
      .update({ confidence: 'monitored' })
      .eq('id', group.id)
    promoted = !pErr
  }

  // Backfill de l'historique MV de la chaîne (mêmes gates que le cron quotidien).
  const result = await scrapeGroup(
    { id: source.id, url: source.url, group_id: source.group_id! },
    apiKey,
    supabase,
    { maxPages: 10 },
  )
  return {
    seeded: true,
    sourceId: source.id,
    backfilled: result.inserted,
    promoted,
    units: result.units,
  }
}
