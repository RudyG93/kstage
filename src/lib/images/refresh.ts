// R4-B (2026-07-13) — pipeline unique de fraîcheur des images, 3 phases,
// partagé entre le cron quotidien (/api/cron/refresh-images) et le runner
// local one-off (scripts/refresh-images-once.ts).
//
//   1. groups.image_url      ← Spotify PAR ID (jamais par nom) + garde de nom
//   2. groups.banner_yt_url  ← bannière de la chaîne YouTube EXCLUSIVE au
//                              groupe (brandingSettings, '=w2560' = 2560x1440)
//   3. members.photo_url     ← kpop.fandom (MediaWiki API), photos d'ère
//                              courante, self-hostées, rotation par lots
//
// Sources vérifiées live le 2026-07-12 (cf. JOURNAL) : kprofiles est figé
// (~2020), TheAudioDB sert des fanarts 2018-2021, le thumbnail MV hqdefault
// est flou (480x360). Fandom expose un cache-buster `cb=` = clé de changement.

import type { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { parseSpotifyArtistId, spotifyArtistById, spotifyNameMatches } from '@/lib/spotify'

type SupabaseClient = ReturnType<typeof createClient<Database>>

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '')

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

// ---------------------------------------------------------------------------
// Phase 1 — images carrées de groupes, Spotify par ID
// ---------------------------------------------------------------------------

export interface GroupImagesSummary {
  total: number
  updated: number
  /** `slug (nom DB) ≠ nom Spotify` — lien probablement mal seedé, RIEN écrit. */
  mismatches: string[]
  noLink: number
  apiMisses: number
}

export async function refreshGroupImages(
  supabase: SupabaseClient,
  token: string,
  opts: { limit?: number } = {},
): Promise<GroupImagesSummary> {
  let query = supabase.from('groups').select('id, slug, name, links, image_url').order('name')
  if (opts.limit) query = query.limit(opts.limit)
  const { data: groups, error } = await query
  if (error) throw new Error(`groups select: ${error.message}`)

  const summary: GroupImagesSummary = {
    total: groups?.length ?? 0,
    updated: 0,
    mismatches: [],
    noLink: 0,
    apiMisses: 0,
  }

  for (const g of groups ?? []) {
    const links = g.links as Record<string, string> | null
    const artistId = parseSpotifyArtistId(links?.spotify)
    if (!artistId) {
      summary.noLink++
      continue
    }
    const artist = await spotifyArtistById(artistId, token)
    if (!artist) {
      summary.apiMisses++
      await sleep(200)
      continue
    }
    if (!spotifyNameMatches(g.name, artist.name)) {
      summary.mismatches.push(`${g.slug} (${g.name}) ≠ spotify:${artist.name}`)
      await sleep(200)
      continue
    }
    const patch: { image_url?: string; spotify_followers?: number } = {}
    if (artist.image && artist.image !== g.image_url) patch.image_url = artist.image
    if (artist.followers != null) patch.spotify_followers = artist.followers
    if (Object.keys(patch).length > 0) {
      const { error: upErr } = await supabase.from('groups').update(patch).eq('id', g.id)
      if (upErr) console.error(`refresh-images update ${g.slug}: ${upErr.message}`)
      else summary.updated++
    }
    await sleep(200)
  }
  return summary
}

// ---------------------------------------------------------------------------
// Phase 2 — bannières larges, chaîne YouTube exclusive au groupe
// ---------------------------------------------------------------------------

export interface YtBannersSummary {
  channels: number
  updated: number
  /** Groupes dont TOUTES les chaînes sont partagées (label) : pas de bannière. */
  sharedOnly: number
  units: number
}

interface BrandingItem {
  id: string
  brandingSettings?: { image?: { bannerExternalUrl?: string } }
}

export async function refreshYtBanners(
  supabase: SupabaseClient,
  apiKey: string,
): Promise<YtBannersSummary> {
  const { data: sources, error } = await supabase
    .from('sources')
    .select('group_id, channel_id, subscriber_count')
    .eq('type', 'youtube_api')
    .not('group_id', 'is', null)
    .not('channel_id', 'is', null)
  if (error) throw new Error(`sources select: ${error.message}`)

  // Une chaîne partagée par plusieurs groupes est une chaîne de LABEL (SMTOWN,
  // HYBE LABELS…) : sa bannière ne représente aucun groupe en particulier.
  // On ne pose banner_yt_url que depuis une chaîne exclusive au groupe.
  const groupsByChannel = new Map<string, Set<string>>()
  for (const s of sources ?? []) {
    const set = groupsByChannel.get(s.channel_id!) ?? new Set()
    set.add(s.group_id!)
    groupsByChannel.set(s.channel_id!, set)
  }
  const bestChannelByGroup = new Map<string, { channelId: string; subs: number }>()
  const sharedOnlyGroups = new Set<string>()
  for (const s of sources ?? []) {
    if (groupsByChannel.get(s.channel_id!)!.size > 1) {
      sharedOnlyGroups.add(s.group_id!)
      continue
    }
    const subs = s.subscriber_count ?? 0
    const cur = bestChannelByGroup.get(s.group_id!)
    if (!cur || subs > cur.subs)
      bestChannelByGroup.set(s.group_id!, { channelId: s.channel_id!, subs })
  }
  for (const gid of bestChannelByGroup.keys()) sharedOnlyGroups.delete(gid)

  const { data: groups } = await supabase.from('groups').select('id, banner_yt_url')
  const currentBanner = new Map((groups ?? []).map((g) => [g.id, g.banner_yt_url]))

  const groupByChannel = new Map(
    [...bestChannelByGroup.entries()].map(([gid, c]) => [c.channelId, gid]),
  )
  const channelIds = [...groupByChannel.keys()]
  const summary: YtBannersSummary = {
    channels: channelIds.length,
    updated: 0,
    sharedOnly: sharedOnlyGroups.size,
    units: 0,
  }

  for (let i = 0; i < channelIds.length; i += 50) {
    const batch = channelIds.slice(i, i + 50)
    summary.units++
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=brandingSettings&id=${batch.join(',')}&key=${apiKey}`,
    )
    if (!res.ok) {
      console.error(`refresh-images banners: channels.list HTTP ${res.status}`)
      continue
    }
    const data = (await res.json()) as { items?: BrandingItem[] }
    for (const item of data.items ?? []) {
      const raw = item.brandingSettings?.image?.bannerExternalUrl
      if (!raw) continue
      const banner = `${raw}=w2560`
      const groupId = groupByChannel.get(item.id)
      if (!groupId || currentBanner.get(groupId) === banner) continue
      const { error: upErr } = await supabase
        .from('groups')
        .update({ banner_yt_url: banner })
        .eq('id', groupId)
      if (upErr) console.error(`refresh-images banner ${groupId}: ${upErr.message}`)
      else summary.updated++
    }
  }
  return summary
}

// ---------------------------------------------------------------------------
// Phase 3 — photos membres, kpop.fandom (MediaWiki), rotation par lots
// ---------------------------------------------------------------------------

export interface MemberPhotosSummary {
  checked: number
  updated: number
  misses: number
  failures: number
  /** api.php inaccessible (Cloudflare ?) : phase à re-router si persistant. */
  apiBlocked: boolean
}

interface FandomQueryResponse {
  query?: {
    normalized?: { from: string; to: string }[]
    redirects?: { from: string; to: string }[]
    pages?: Record<string, { title?: string; original?: { source?: string } }>
  }
}

const PHOTO_BUCKET = 'member-photos'
const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
}

export async function refreshMemberPhotos(
  supabase: SupabaseClient,
  opts: { batch?: number } = {},
): Promise<MemberPhotosSummary> {
  const batchSize = opts.batch ?? 100
  const { data: members, error } = await supabase
    .from('members')
    .select('id, stage_name, photo_url, photo_source_key, groups!inner(name, slug)')
    .order('photo_checked_at', { ascending: true, nullsFirst: true })
    .limit(batchSize)
  if (error) throw new Error(`members select: ${error.message}`)

  const summary: MemberPhotosSummary = {
    checked: 0,
    updated: 0,
    misses: 0,
    failures: 0,
    apiBlocked: false,
  }
  const now = new Date().toISOString()

  // Titre fandom conventionnel : « Stage Name (nom du groupe) » — vérifié sur
  // « Karina (aespa) », « Soyeon (i-dle) ». Les misses gardent leur photo
  // actuelle (self-host kprofiles) et sortent de la rotation jusqu'au tour
  // suivant.
  type Target = NonNullable<typeof members>[number] & { fandomTitle: string }
  const targets: Target[] = (members ?? []).map((m) => ({
    ...m,
    fandomTitle: `${m.stage_name} (${m.groups.name})`,
  }))

  for (let i = 0; i < targets.length; i += 50) {
    const batch = targets.slice(i, i + 50)
    const titles = batch.map((t) => t.fandomTitle).join('|')
    let data: FandomQueryResponse | null = null
    try {
      const res = await fetch(
        `https://kpop.fandom.com/api.php?action=query&format=json&redirects=1&prop=pageimages&piprop=original&titles=${encodeURIComponent(titles)}`,
        { headers: { 'User-Agent': UA, Accept: 'application/json' } },
      )
      if (res.ok) data = (await res.json()) as FandomQueryResponse
      else if (res.status === 403) summary.apiBlocked = true
    } catch {
      summary.failures++
    }

    // Résolution titre demandé → titre de page (normalisations + redirects).
    const forward = new Map<string, string>()
    for (const n of data?.query?.normalized ?? []) forward.set(n.from, n.to)
    for (const r of data?.query?.redirects ?? []) {
      forward.set(r.from, r.to)
      // chaîne normalisé → redirigé
      for (const [from, to] of forward) if (to === r.from) forward.set(from, r.to)
    }
    const finalTitle = (requested: string) => {
      let t = requested
      for (let hops = 0; hops < 3; hops++) {
        const next = forward.get(t)
        if (!next) break
        t = next
      }
      return norm(t)
    }
    const sourceByTitle = new Map<string, string>()
    for (const page of Object.values(data?.query?.pages ?? {})) {
      if (page.title && page.original?.source)
        sourceByTitle.set(norm(page.title), page.original.source)
    }

    for (const m of batch) {
      summary.checked++
      const source = sourceByTitle.get(finalTitle(m.fandomTitle))
      if (!source) {
        summary.misses++
        await supabase.from('members').update({ photo_checked_at: now }).eq('id', m.id)
        continue
      }
      if (source === m.photo_source_key) {
        await supabase.from('members').update({ photo_checked_at: now }).eq('id', m.id)
        continue
      }
      // Nouvelle photo (ou jamais sourcée fandom) : self-host puis bascule.
      try {
        const dl = await fetch(source, { headers: { 'User-Agent': UA } })
        const type = dl.headers.get('content-type')?.split(';')[0].trim() ?? ''
        if (!dl.ok || !type.startsWith('image/')) throw new Error(`HTTP ${dl.status} ${type}`)
        const bytes = await dl.arrayBuffer()
        if (bytes.byteLength < 1024) throw new Error('image trop petite')
        const ext = EXT_BY_TYPE[type] ?? 'jpg'
        const path = `${m.id}.${ext}`
        const { error: upErr } = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(path, bytes, { contentType: type, upsert: true })
        if (upErr) throw new Error(upErr.message)
        const { data: pub } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path)
        // `?v=cb` : upsert = même chemin, le CDN servirait l'ancienne version.
        const cb = /[?&]cb=(\d+)/.exec(source)?.[1] ?? String(bytes.byteLength)
        const { error: dbErr } = await supabase
          .from('members')
          .update({
            photo_url: `${pub.publicUrl}?v=${cb}`,
            photo_source_key: source,
            photo_checked_at: now,
          })
          .eq('id', m.id)
        if (dbErr) throw new Error(dbErr.message)
        summary.updated++
      } catch (e) {
        summary.failures++
        console.error(`refresh-images photo ${m.groups.slug}/${m.stage_name}: ${String(e)}`)
        await supabase.from('members').update({ photo_checked_at: now }).eq('id', m.id)
      }
      await sleep(150)
    }
  }
  return summary
}
