import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { buildEventSlug, generateUniqueSlug } from '@/lib/events/slug'
import { matchesGroup } from './group-match'
import { decodeHtmlEntities } from './html-entities'
import { isOfficialMvTitle } from './is-official-mv'
import { detectMvVersion, type MemberRef } from './mv-version'

type EventType = Database['public']['Enums']['event_type']
type SupabaseClient = ReturnType<typeof createClient<Database>>

// P0.4 (2026-06-12) : pipeline `playlistItems.list` (1 unit/page de 50) au lieu
// de 2× `search.list` (100 units/call). Coût par source : 1 (channels.list) +
// maxPages (playlistItems) + ~1 (videos.list batché sur les seuls candidats MV)
// ≈ 4-5 units vs 200 avant — prérequis de l'élargissement de couverture.
// Le videos.list apporte en plus `liveBroadcastContent` + `scheduledStartTime` :
// les PREMIERES PROGRAMMÉES deviennent des events datés dans le futur, le seul
// futur que YouTube puisse fournir. Cf. SCRAPING.md §2.

/** 403 quotaExceeded : le quota est global au projet — inutile de continuer. */
export class QuotaExceededError extends Error {
  constructor() {
    super('YouTube API daily quota exceeded')
    this.name = 'QuotaExceededError'
  }
}

interface UploadItem {
  videoId: string
  title: string // décodé (entities HTML, cf. §3.1)
  description: string // décodé
  publishedAt: string
  thumbnailUrl: string | null
}

interface VideoDetails {
  liveBroadcastContent: 'none' | 'live' | 'upcoming'
  scheduledStartTime: string | null
}

interface ScrapeResult {
  inserted: number
  skipped: number
  /** Inserts datés dans le futur (premieres programmées). */
  premieres: number
  /** Unités de quota YouTube consommées par ce run. */
  units: number
}

// Contenu dérivé d'un MV (teasers, behinds, makings, reactions…) qu'on ne veut
// PAS classer comme 'mv' : sinon la page /mv/[slug] et la section "MV of the
// month" se remplissent de teasers, behind-the-scenes et reactions au lieu des
// vrais clips. `\b` autour des mots ambigus EN pour éviter les faux négatifs
// (ex. "preview" dans "Recipe Preview" doit matcher mais pas "approval").
//
// Markers hangul ajoutés après audit MCP (cf. SCRAPING.md §3.6) : les chaînes
// officielles K-pop postent massivement du contenu en coréen. Sans ces markers,
// les séries "I-TALK #X : 'XXX' M/V 촬영 비하인드" passaient en 'mv'.
//   비하인드 = "behind"   메이킹 = "making"   티저 = "teaser"
//   리액션 = "reaction"   현장 = "on-site/scene"   예고 = "preview"
const DERIVATIVE_RE =
  /\bbehind\b|\bteaser\b|\btrailer\b|\bmaking[- ]of\b|\brecording\b|\brehearsal\b|\bpractice\b|\bpreview\b|\breaction\b|highlight medley|highlight clip|schedule poster|\brecipe\b|cheering guide|performance video|dance practice|documentary|r\(ae\)cord|\breplay\b|compilation|\bepisode\b|\bep\.\s*\d+|\bvlog\b|#shorts|비하인드|메이킹|티저|리액션|현장|예고/i

// P0.2 (audit 2026-06-12) : un même MV est souvent posté par la chaîne du
// groupe ET celle du label (ex. ILLIT vs HYBE LABELS — titres identiques au
// préfixe « # » près), avec des videoId/source_url différents : la contrainte
// unique DB ne suffit pas. Dédup par titre normalisé à ±14 jours. L'égalité
// est STRICTE (pas d'inclusion) : « 'Better Things' MV » et « 'Better Things'
// MV (æ-aespa Ver.) » sont deux events légitimes (mv_kind les distingue).
const DUP_WINDOW_MS = 14 * 24 * 60 * 60 * 1000

export function normalizeMvTitle(title: string): string {
  return title
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

export function detectEventType(title: string, description: string): EventType {
  const text = `${title} ${description}`
  // Early-reject derivatives : ils peuvent contenir "MV", "Album", etc. sans
  // pour autant représenter l'event réel — on les renvoie tous en 'other'.
  if (DERIVATIVE_RE.test(text)) return 'other'

  const lower = text.toLowerCase()
  // MV (clip) en premier : un titre de clip peut aussi mentionner l'album.
  if (/\bmv\b|\bm\/v\b|music video|official video/.test(lower)) return 'mv'
  if (
    /mini album|full album|single album|\balbum\b|\bsingle\b|\bep\b|album release|comeback/.test(
      lower,
    )
  )
    return 'release'
  if (/concert|tour/.test(lower)) return 'concert'
  if (/m countdown|music bank|inkigayo|show champion|the show|music core/.test(lower))
    return 'music_show'
  // 'anniversary' n'est jamais scrapé : les anniversaires sont auto-générés à
  // la volée depuis members.birthday + groups.debut_date (cf. anniversaries.ts).
  // Le scraper YT classait en faux positif tout titre contenant "Debut"
  // (BABYMONSTER "DEBUT SPECIAL"/"PRE-DEBUT SONG"…).
  if (/live|vlive|weverse live|stream/.test(lower)) return 'live'
  return 'other'
}

/**
 * start_at d'un candidat : une premiere programmée (`upcoming`/`live`) est
 * datée à son `scheduledStartTime` — c'est un event FUTUR. Une vidéo publiée
 * garde sa date de publication (pour un MV, publication = sortie du clip).
 */
export function pickStartAt(details: VideoDetails | undefined, publishedAt: string): string {
  if (
    details &&
    details.scheduledStartTime &&
    (details.liveBroadcastContent === 'upcoming' || details.liveBroadcastContent === 'live')
  ) {
    return details.scheduledStartTime
  }
  return publishedAt
}

/** fetch + erreurs communes : quota (403 quotaExceeded) → erreur dédiée. */
async function ytFetch(url: string): Promise<unknown> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    if (res.status === 403 && body.includes('quotaExceeded')) throw new QuotaExceededError()
    throw new Error(`YouTube API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json()
}

interface ChannelMeta {
  channelId: string
  uploadsPlaylistId: string
  subscriberCount: number | null
}

/**
 * channels.list (1 unit) : résout l'URL (`/channel/UC…` ou `@handle`) et
 * renvoie en un seul appel l'id, la playlist "uploads" (toutes les vidéos de
 * la chaîne, triées récentes d'abord) et le subscriberCount — notre critère de
 * popularité de remplacement (spotify_followers est inalimentable).
 */
async function resolveChannel(channelUrl: string, apiKey: string): Promise<ChannelMeta> {
  const direct = channelUrl.match(/\/channel\/(UC[\w-]+)/)?.[1]
  const handle = channelUrl.match(/@[\w.-]+/)?.[0]
  if (!direct && !handle) throw new Error(`Cannot parse channel URL: ${channelUrl}`)
  const selector = direct ? `id=${direct}` : `forHandle=${encodeURIComponent(handle!)}`

  const data = (await ytFetch(
    `https://www.googleapis.com/youtube/v3/channels?part=contentDetails,statistics&${selector}&key=${apiKey}`,
  )) as {
    items?: {
      id: string
      contentDetails?: { relatedPlaylists?: { uploads?: string } }
      statistics?: { subscriberCount?: string; hiddenSubscriberCount?: boolean }
    }[]
  }
  const item = data.items?.[0]
  const uploads = item?.contentDetails?.relatedPlaylists?.uploads
  if (!item || !uploads) throw new Error(`Channel not found for: ${channelUrl}`)

  const stats = item.statistics
  const subscriberCount =
    stats && !stats.hiddenSubscriberCount && stats.subscriberCount != null
      ? Number(stats.subscriberCount)
      : null

  return { channelId: item.id, uploadsPlaylistId: uploads, subscriberCount }
}

/** playlistItems.list (1 unit) : une page de 50 uploads, plus récents d'abord. */
async function fetchUploadsPage(
  playlistId: string,
  apiKey: string,
  pageToken?: string,
): Promise<{ items: UploadItem[]; nextPageToken: string | null }> {
  const data = (await ytFetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails` +
      `&playlistId=${playlistId}&maxResults=50${pageToken ? `&pageToken=${pageToken}` : ''}&key=${apiKey}`,
  )) as {
    items?: {
      snippet?: {
        title?: string
        description?: string
        publishedAt?: string
        thumbnails?: { default?: { url?: string } }
        resourceId?: { videoId?: string }
      }
      contentDetails?: { videoId?: string; videoPublishedAt?: string }
    }[]
    nextPageToken?: string
  }

  const items: UploadItem[] = []
  for (const it of data.items ?? []) {
    const videoId = it.contentDetails?.videoId ?? it.snippet?.resourceId?.videoId
    if (!videoId) continue
    items.push({
      videoId,
      title: decodeHtmlEntities(it.snippet?.title ?? ''),
      description: decodeHtmlEntities(it.snippet?.description ?? ''),
      // videoPublishedAt = publication de la vidéo ; absent pour une premiere
      // pas encore diffusée → fallback sur la date d'ajout à la playlist
      // (pickStartAt la remplacera par scheduledStartTime).
      publishedAt: it.contentDetails?.videoPublishedAt ?? it.snippet?.publishedAt ?? '',
      thumbnailUrl: it.snippet?.thumbnails?.default?.url ?? null,
    })
  }
  return { items, nextPageToken: data.nextPageToken ?? null }
}

/** videos.list (1 unit / 50 ids) : détails premiere des seuls candidats MV. */
async function fetchVideoDetails(
  videoIds: string[],
  apiKey: string,
): Promise<{ details: Map<string, VideoDetails>; calls: number }> {
  const details = new Map<string, VideoDetails>()
  let calls = 0
  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50)
    calls++
    const data = (await ytFetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,liveStreamingDetails` +
        `&id=${chunk.join(',')}&key=${apiKey}`,
    )) as {
      items?: {
        id: string
        snippet?: { liveBroadcastContent?: string }
        liveStreamingDetails?: { scheduledStartTime?: string }
      }[]
    }
    for (const v of data.items ?? []) {
      details.set(v.id, {
        liveBroadcastContent: (v.snippet?.liveBroadcastContent ?? 'none') as
          | 'none'
          | 'live'
          | 'upcoming',
        scheduledStartTime: v.liveStreamingDetails?.scheduledStartTime ?? null,
      })
    }
  }
  return { details, calls }
}

export async function scrapeGroup(
  source: { id: string; url: string; group_id: string },
  apiKey: string,
  supabase: SupabaseClient,
  opts: { maxPages?: number } = {},
): Promise<ScrapeResult> {
  // 2 pages = 100 uploads les plus récents : large pour un run quotidien (un
  // nouveau MV est toujours en tête de playlist). Le backfill d'onboarding
  // d'une nouvelle source passe maxPages élevé pour remonter l'historique.
  const maxPages = opts.maxPages ?? 2
  let units = 0

  units++
  const channel = await resolveChannel(source.url, apiKey)

  // Charge le slug + name du groupe pour générer les slugs d'events.
  // Le name est nécessaire pour dédupliquer les préfixes quand le titre scrapé
  // commence par le nom du groupe (cf. buildEventSlug).
  const { data: group } = await supabase
    .from('groups')
    .select('slug, name')
    .eq('id', source.group_id)
    .maybeSingle()
  const groupSlug = group?.slug ?? null
  const groupName = group?.name ?? null

  // Membres du groupe (pour detectMvVersion). Charge une seule fois par scrape.
  const { data: membersData } = await supabase
    .from('members')
    .select('id, stage_name')
    .eq('group_id', source.group_id)
  const members: MemberRef[] = membersData ?? []

  // MVs déjà en DB pour ce groupe, toutes chaînes confondues — base de la
  // dédup cross-chaînes (§3.9). Rechargé à chaque source : les inserts de la
  // chaîne précédente du même groupe sont visibles pour la suivante.
  const { data: existingMvs } = await supabase
    .from('events')
    .select('title, start_at')
    .eq('group_id', source.group_id)
    .eq('type', 'mv')
  const knownMvs = (existingMvs ?? []).map((e) => ({
    norm: normalizeMvTitle(e.title),
    startAt: new Date(e.start_at).getTime(),
  }))

  // Uploads paginés (récents → anciens), borné par maxPages.
  const items: UploadItem[] = []
  let pageToken: string | undefined
  for (let page = 0; page < maxPages; page++) {
    units++
    const res = await fetchUploadsPage(channel.uploadsPlaylistId, apiKey, pageToken)
    items.push(...res.items)
    if (!res.nextPageToken) break
    pageToken = res.nextPageToken
  }

  let skipped = 0

  // Gates titre (gratuits) AVANT le videos.list payant : on ne paie le détail
  // premiere que pour les vrais candidats MV (typiquement 0-5 par run).
  const candidates: UploadItem[] = []
  for (const item of items) {
    // P0.1 (audit 2026-06-12) : YouTube n'ingère QUE les MV officiels. Un upload
    // ne porte que sa date de publication — jamais la date d'un event réel
    // (sauf premieres programmées, datées plus bas par pickStartAt). Les types
    // 'release'/'concert' déduits d'uploads étaient du bruit promo. Désormais :
    // release = kpopofficial (annonces datées), concert = suggestions manuelles,
    // music_show = source dédiée.
    if (detectEventType(item.title, item.description) !== 'mv') {
      skipped++
      continue
    }

    // §4.1 — gate strict « MV officiel uniquement ». detectEventType classe
    // largement en 'mv' (tout titre avec un marqueur MV) ; ce filtre exige en
    // plus l'absence de tout terme dérivé (teaser, performance, out now, etc.)
    // pour ne garder que le clip principal. Les rejets sont loggués pour audit.
    const check = isOfficialMvTitle(item.title)
    if (!check.official) {
      console.warn(`[yt] skip non-official MV (${check.reason}): ${item.title}`)
      skipped++
      continue
    }

    // Filtre nom de groupe : sur une chaîne d'agence (SMTOWN, YG, HYBE…),
    // évite d'ingérer les MVs des autres groupes signés à la même agence.
    // TITRE SEUL (§3.10) : les descriptions des chaînes umbrella listent tous
    // leurs artistes en hashtags (#GIDLE #BTOB #VICTON…) — matcher la
    // description attribuait des MV d'autres artistes au groupe (faux positif
    // Lee Changsub→i-dle, 2026-06-13). Convention k-pop : le titre d'un MV
    // officiel porte toujours l'artiste.
    if (groupName && !matchesGroup(item.title, groupName)) {
      skipped++
      continue
    }

    candidates.push(item)
  }

  // Détails premiere (scheduledStartTime) des candidats survivants.
  let videoDetails = new Map<string, VideoDetails>()
  if (candidates.length > 0) {
    const res = await fetchVideoDetails(
      candidates.map((c) => c.videoId),
      apiKey,
    )
    videoDetails = res.details
    units += res.calls
  }

  // Idempotence batchée : un seul SELECT pour tous les candidats (vs un par
  // item avant P0.4).
  const existingUrls = new Set<string>()
  if (candidates.length > 0) {
    const { data: existingRows } = await supabase
      .from('events')
      .select('source_url')
      .in(
        'source_url',
        candidates.map((c) => `https://www.youtube.com/watch?v=${c.videoId}`),
      )
    for (const row of existingRows ?? []) {
      if (row.source_url) existingUrls.add(row.source_url)
    }
  }

  let inserted = 0
  let premieres = 0

  for (const item of candidates) {
    const sourceUrl = `https://www.youtube.com/watch?v=${item.videoId}`
    if (existingUrls.has(sourceUrl)) {
      skipped++
      continue
    }

    const details = videoDetails.get(item.videoId)
    const startAt = pickStartAt(details, item.publishedAt)
    if (!startAt) {
      // Vidéo privée/dégénérée sans aucune date exploitable.
      skipped++
      continue
    }
    const isPremiere = details?.liveBroadcastContent === 'upcoming'

    // Dédup cross-chaînes (cf. SCRAPING.md §3.9) : même titre normalisé à
    // ±14 jours pour ce groupe → déjà ingéré depuis une autre chaîne, skip.
    // Premier arrivé gagne (l'ordre des sources décide de la chaîne gardée).
    const startAtMs = new Date(startAt).getTime()
    const norm = normalizeMvTitle(item.title)
    const isDuplicate = knownMvs.some(
      (m) => m.norm === norm && Math.abs(m.startAt - startAtMs) <= DUP_WINDOW_MS,
    )
    if (isDuplicate) {
      console.warn(`[yt] skip cross-channel duplicate: ${item.title}`)
      skipped++
      continue
    }

    // Slug pour la route article (`/mv/[slug]`). Skip si on n'a pas pu récupérer
    // le slug du groupe (cas dégénéré ; l'event est inséré sans slug et sera
    // rattrapé par le backfill).
    let slug: string | null = null
    if (groupSlug) {
      const base = buildEventSlug(groupSlug, item.title, groupName)
      slug = await generateUniqueSlug(base, async (candidate) => {
        const { data } = await supabase
          .from('events')
          .select('id')
          .eq('slug', candidate)
          .maybeSingle()
        return Boolean(data)
      })
    }

    // mv_kind + member_id : classification de version (main / performance /
    // member / other_version) — tout ce qui passe le gate est un MV.
    const version = detectMvVersion(item.title, members, groupName ?? undefined)

    const { error } = await supabase.from('events').insert({
      group_id: source.group_id,
      source_id: source.id,
      source_url: sourceUrl,
      type: 'mv',
      title: item.title,
      description: item.description.slice(0, 500) || null,
      start_at: startAt,
      status: 'confirmed',
      image_url: item.thumbnailUrl,
      slug,
      mv_kind: version.kind,
      member_id: version.memberId,
    })

    if (error) {
      console.error(`Insert failed for ${sourceUrl}:`, error.message)
      skipped++
    } else {
      inserted++
      if (isPremiere) premieres++
      // Visible pour les items suivants du même run (ex. la même vidéo postée
      // deux fois par la chaîne sous des videoId distincts).
      knownMvs.push({ norm, startAt: startAtMs })
    }
  }

  // last_scraped_at : on n'arrive ici que si les fetches ont réussi (les
  // erreurs réseau/quota ont throw plus haut). Au passage, on persiste le
  // channel_id résolu + le subscriberCount (critère de popularité P0.5).
  await supabase
    .from('sources')
    .update({
      last_scraped_at: new Date().toISOString(),
      channel_id: channel.channelId,
      subscriber_count: channel.subscriberCount,
    })
    .eq('id', source.id)

  return { inserted, skipped, premieres, units }
}
