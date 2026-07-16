/**
 * Auto-découverte des debuts (R4-I) — orchestration :
 *   1. DÉTECTION  : Category:{YYYY}_debuts sur kpop.fandom (diff contre
 *      debut_candidates, idempotence par fandom_pageid).
 *   2. GATE       : auto-création SEULEMENT si date de debut concrète ET un
 *      signal d'AUDIENCE réel — chaîne YouTube vérifiée (forHandle, ≥ 10k subs)
 *      OU fans Deezer ≥ 5k (R10 : plus de « label déjà en base » seul, qui
 *      laissait passer tout nugu d'une major). Le reste part en revue admin
 *      (/admin/debuts). Scan BACKFILLÉ sur les 3 années passées + année courante.
 *   3. CRÉATION   : groups + members (lineup annoncé, actifs) + source
 *      youtube_api vérifiée (le cron scrape-youtube prend le relais) + event
 *      release « {name} debut » — les crons existants (kpopofficial,
 *      wikipedia, refresh-images) enrichissent ensuite tout seuls.
 */
import type { createClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database'
import { kstToUtcISO } from '@/lib/events/date'
import { fetchDebutCategory, fetchInfobox, resolveImageUrl } from './fandom'
import { fetchWikipediaDebutNames, normalizeDebutName } from './wikipedia-debuts'

type SupabaseClient = ReturnType<typeof createClient<Database>>

// Bornes de run : la catégorie fandom contient ~100+ pages au premier scan —
// on avale le stock en quelques jours sans faire déborder le cron (parse =
// 1 requête/page). En régime établi : 0-2 nouvelles pages/jour.
const MAX_PARSES_PER_RUN = 12
const MIN_YT_SUBS = 10_000
// Seuil de popularité Deezer (aligné sur build-roster MIN_FANS). Le gate exige
// désormais un signal d'AUDIENCE réel (YT subs OU fans Deezer) — l'ancien
// « label déjà en base » laissait passer tout nugu d'une major (biais 2026).
const MIN_DEEZER_FANS = 5_000
const GROUP_PHOTO_BUCKET = 'group-photos'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

/** Fans Deezer d'un artiste (match exact du nom, meilleur nb_fan) — signal de popularité du gate. */
async function deezerFans(name: string): Promise<number> {
  try {
    const res = await fetch(
      `https://api.deezer.com/search/artist?limit=5&q=${encodeURIComponent(name)}`,
    )
    if (!res.ok) return 0
    const items = ((await res.json()) as { data?: { name: string; nb_fan: number }[] }).data ?? []
    const n = (s: string) =>
      s
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^a-z0-9]/g, '')
    return (
      items.filter((a) => a?.name && n(a.name) === n(name)).sort((a, b) => b.nb_fan - a.nb_fan)[0]
        ?.nb_fan ?? 0
    )
  } catch {
    return 0
  }
}

export interface DebutCandidatePayload {
  name: string
  debutDate: string | null
  label: string | null
  members: string[]
  youtubeHandle: string | null
  instagram: string | null
  imageUrl: string | null
  wikipediaListed: boolean
  ytVerified: { channelId: string; subs: number } | null
  fandomUrl: string
  reason?: string
  /** Fans Deezer au moment du scan (Phase 3 Lot 3) — persisté pour que la
   * revue admin voie le signal d'audience qui a décidé du gate. */
  deezerFans?: number
}

/**
 * Décision du gate d'auto-création (Phase 3 Lot 3 — pur, testable) :
 * autoCreate = date concrète ET audience réelle (YT ≥ 10k subs OU Deezer
 * ≥ 5k fans) ; confidence = `monitored` si chaîne vérifiée (canal MV sûr),
 * sinon `candidate` (quarantaine : noindex, hors sitemap, jamais notifié).
 * C'est LE point unique qui incarne le garde-fou de l'audit : « ne jamais
 * publier une identité ambiguë pour augmenter le compteur ».
 */
export function debutGateDecision(
  payload: Pick<DebutCandidatePayload, 'debutDate' | 'ytVerified'>,
  deezerFanCount: number,
): { autoCreate: boolean; confidence: 'monitored' | 'candidate' } {
  const audience =
    (payload.ytVerified !== null && payload.ytVerified.subs >= MIN_YT_SUBS) ||
    deezerFanCount >= MIN_DEEZER_FANS
  return {
    autoCreate: payload.debutDate !== null && audience,
    confidence: payload.ytVerified ? 'monitored' : 'candidate',
  }
}

export interface DebutIngestResult {
  scanned: number
  newPages: number
  created: string[]
  pending: string[]
  dismissed: number
  blocked: boolean
  errors: string[]
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

async function verifyYouTubeHandle(
  handle: string,
  apiKey: string,
): Promise<{ channelId: string; subs: number } | null> {
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&forHandle=${encodeURIComponent(handle)}&key=${apiKey}`,
  )
  if (!res.ok) return null
  const data = (await res.json()) as {
    items?: { id: string; statistics?: { subscriberCount?: string } }[]
  }
  const item = data.items?.[0]
  if (!item) return null
  return { channelId: item.id, subs: Number(item.statistics?.subscriberCount ?? 0) }
}

/** Self-host de l'image fandom (hotlink static.wikia interdit de fait). */
async function selfHostGroupImage(
  supabase: SupabaseClient,
  slug: string,
  imageUrl: string,
): Promise<string | null> {
  try {
    const { data: buckets } = await supabase.storage.listBuckets()
    if (!buckets?.some((b) => b.name === GROUP_PHOTO_BUCKET)) {
      await supabase.storage.createBucket(GROUP_PHOTO_BUCKET, { public: true })
    }
    const res = await fetch(imageUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    const type = res.headers.get('content-type')?.split(';')[0].trim() ?? ''
    if (!res.ok || !type.startsWith('image/')) return null
    const bytes = await res.arrayBuffer()
    if (bytes.byteLength < 1024) return null
    const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'
    const path = `${slug}.${ext}`
    const { error } = await supabase.storage
      .from(GROUP_PHOTO_BUCKET)
      .upload(path, bytes, { contentType: type, upsert: true })
    if (error) return null
    return supabase.storage.from(GROUP_PHOTO_BUCKET).getPublicUrl(path).data.publicUrl
  } catch {
    return null
  }
}

/**
 * Crée groupe + membres + source + event debut depuis un payload candidat.
 * Utilisé par le gate automatique ET par le bouton Create de /admin/debuts.
 *
 * RÉCUPÉRABLE (Phase 3 Lot 3, action « création transactionnelle ou
 * récupérable ») : chaque étape est idempotente et un rappel REPREND une
 * création interrompue (groupe déjà là → resume, membres insérés par
 * différence, source tolérante au duplicate, event déjà idempotent). Pas de
 * RPC transactionnelle : l'upload Storage n'est pas transactionnable et le
 * bouton Create de /admin/debuts devient « retry = resume » gratuitement.
 * Les échecs d'étapes remontent dans `stepErrors` (visibles en scrape_log).
 */
export async function createFromPayload(
  supabase: SupabaseClient,
  payload: DebutCandidatePayload,
): Promise<{ groupId: string; resumed: boolean; stepErrors: string[] } | { error: string }> {
  if (!payload.name) return { error: 'payload sans nom' }
  const stepErrors: string[] = []

  // Slug unique (collision → suffixe année).
  const base = slugify(payload.name)
  if (!base) return { error: `slug vide pour « ${payload.name} »` }
  const { data: taken } = await supabase
    .from('groups')
    .select('id, slug, name')
    .ilike('slug', `${base}%`)
  const takenSet = new Set((taken ?? []).map((g) => g.slug))

  // RESUME : si un groupe du MÊME NOM existe déjà (création interrompue après
  // l'insert groups, ou re-clic admin), on reprend son id et on complète les
  // étapes manquantes au lieu d'échouer sur « slug déjà pris ».
  const sameName = (taken ?? []).find(
    (g) => normalizeDebutName(g.name) === normalizeDebutName(payload.name),
  )
  let groupId: string
  let slug: string
  let resumed = false
  if (sameName) {
    groupId = sameName.id
    slug = sameName.slug
    resumed = true
  } else {
    slug = !takenSet.has(base) ? base : `${base}-${payload.debutDate?.slice(0, 4) ?? 'new'}`
    if (takenSet.has(slug)) return { error: `slug déjà pris: ${slug}` }

    const links: Record<string, string> = {}
    if (payload.ytVerified)
      links.youtube = `https://www.youtube.com/channel/${payload.ytVerified.channelId}`
    if (payload.instagram) links.instagram = `https://www.instagram.com/${payload.instagram}`

    const image = payload.imageUrl
      ? await selfHostGroupImage(supabase, slug, payload.imageUrl)
      : null

    const { data: group, error: groupErr } = await supabase
      .from('groups')
      .insert({
        slug,
        name: payload.name,
        agency: payload.label,
        debut_date: payload.debutDate,
        image_url: image,
        links: links as Json,
        is_solo: payload.members.length === 0,
        // Tier de confiance (Phase 3 Lot 2, audit §4.1) : un groupe auto-créé
        // n'est JAMAIS `verified` d'emblée — cf. debutGateDecision.
        confidence: payload.ytVerified ? 'monitored' : 'candidate',
      })
      .select('id')
      .single()
    if (groupErr || !group) return { error: `insert group: ${groupErr?.message}` }
    groupId = group.id
  }

  // Lineup annoncé → membres ACTIFS, insérés PAR DIFFÉRENCE (resume-safe : les
  // slugs membres sont déterministes `${slug}-${stage}`).
  if (payload.members.length > 0) {
    const { data: existingMembers } = await supabase
      .from('members')
      .select('slug')
      .eq('group_id', groupId)
    const existingSlugs = new Set((existingMembers ?? []).map((m) => m.slug))
    const rows = payload.members
      .map((stage) => ({
        group_id: groupId,
        stage_name: stage.replace(/\s*\([^)]*\)\s*$/, ''),
        status: 'active' as const,
        slug: `${slug}-${slugify(stage.replace(/\s*\([^)]*\)\s*$/, ''))}`,
      }))
      .filter((r) => !existingSlugs.has(r.slug))
    if (rows.length > 0) {
      const { error: mErr } = await supabase.from('members').insert(rows)
      if (mErr) stepErrors.push(`members: ${mErr.message}`)
    }
  }

  // Source YouTube vérifiée → le cron quotidien scrape-youtube ingérera les MVs.
  // Idempotent via unique(url, group_id) — le duplicate est un resume normal.
  if (payload.ytVerified) {
    const { error: sErr } = await supabase.from('sources').insert({
      type: 'youtube_api',
      name: `${payload.name} — YouTube`,
      url: `https://www.youtube.com/channel/${payload.ytVerified.channelId}`,
      channel_id: payload.ytVerified.channelId,
      subscriber_count: payload.ytVerified.subs,
      group_id: groupId,
    })
    if (sErr && sErr.code !== '23505') stepErrors.push(`source: ${sErr.message}`)
  }

  // Event debut (release) — idempotent par (source_url, group_id), comme
  // comeback-ingest. Titre sans tiret : displayEventTitle le rend tel quel.
  if (payload.debutDate) {
    const [y, m, d] = payload.debutDate.split('-').map(Number)
    const { data: existing } = await supabase
      .from('events')
      .select('id')
      .eq('group_id', groupId)
      .eq('source_url', payload.fandomUrl)
      .maybeSingle()
    if (!existing) {
      const { error: eErr } = await supabase.from('events').insert({
        group_id: groupId,
        type: 'release',
        title: `${payload.name} debut`,
        start_at: kstToUtcISO(y, m - 1, d, 18, 0),
        status: 'confirmed',
        source_url: payload.fandomUrl,
      })
      if (eErr) stepErrors.push(`event: ${eErr.message}`)
    }
  }

  return { groupId, resumed, stepErrors }
}

/**
 * Ajout CIBLÉ de groupes par NOM (hors scan de catégorie) — pour rattraper
 * immédiatement des groupes populaires précis (RESCENE, PLAVE…) sans attendre
 * que le backfill alphabétique du cron y arrive. Résout la page fandom par
 * recherche, réutilise le MÊME dossier complet (createFromPayload : group +
 * members + source YT + event debut). Non-destructif (skip si déjà en base).
 */
export async function ingestNamedGroups(
  supabase: SupabaseClient,
  names: string[],
  opts: { youtubeKey?: string } = {},
): Promise<{ created: string[]; skipped: { name: string; reason: string }[] }> {
  const created: string[] = []
  const skipped: { name: string; reason: string }[] = []
  const { data: existingGroups } = await supabase.from('groups').select('name')
  const knownNames = new Set((existingGroups ?? []).map((g) => normalizeDebutName(g.name)))
  const wikipediaNames = await fetchWikipediaDebutNames(new Date().getUTCFullYear())

  for (const name of names) {
    if (knownNames.has(normalizeDebutName(name))) {
      skipped.push({ name, reason: 'already-in-db' })
      continue
    }
    let pageids: number[] = []
    try {
      const res = await fetch(
        `https://kpop.fandom.com/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(name)}&srlimit=5`,
        { headers: { 'User-Agent': UA } },
      )
      pageids =
        ((await res.json()) as { query?: { search?: { pageid: number }[] } }).query?.search?.map(
          (s) => s.pageid,
        ) ?? []
    } catch {
      skipped.push({ name, reason: 'search-failed' })
      continue
    }

    let handled = false
    for (const pageid of pageids) {
      const { infobox } = await fetchInfobox(pageid)
      if (!infobox?.name || normalizeDebutName(infobox.name) !== normalizeDebutName(name)) continue
      const ytVerified =
        infobox.youtubeHandle && opts.youtubeKey
          ? await verifyYouTubeHandle(infobox.youtubeHandle, opts.youtubeKey)
          : null
      const imageUrl = infobox.imageFile ? await resolveImageUrl(infobox.imageFile) : null
      const out = await createFromPayload(supabase, {
        name: infobox.name,
        debutDate: infobox.debutDate,
        label: infobox.label,
        members: infobox.members,
        youtubeHandle: infobox.youtubeHandle,
        instagram: infobox.instagram,
        imageUrl,
        wikipediaListed: wikipediaNames.has(normalizeDebutName(infobox.name)),
        ytVerified,
        fandomUrl: `https://kpop.fandom.com/wiki/${encodeURIComponent(infobox.name.replace(/ /g, '_'))}`,
      })
      if ('groupId' in out) created.push(infobox.name)
      else skipped.push({ name, reason: out.error })
      handled = true
      break
    }
    if (!handled) skipped.push({ name, reason: 'no-infobox-match' })
  }
  return { created, skipped }
}

export async function ingestDebuts(
  supabase: SupabaseClient,
  opts: { youtubeKey?: string; nowMs?: number } = {},
): Promise<DebutIngestResult> {
  const nowMs = opts.nowMs ?? Date.now()
  const result: DebutIngestResult = {
    scanned: 0,
    newPages: 0,
    created: [],
    pending: [],
    dismissed: 0,
    blocked: false,
    errors: [],
  }

  // Année courante KST (+ rollover : dès novembre, on surveille aussi N+1) ET
  // BACKFILL des 3 années passées : la découverte était forward-only, donc les
  // groupes actifs/populaires débutés 2023-2025 (RESCENE, PLAVE, UNIS, NEXZ)
  // n'étaient JAMAIS atteints (leur Category:{année}_debuts n'était pas scannée).
  // Idempotent (fandom_pageid), borné par MAX_PARSES_PER_RUN ; le seuil de
  // popularité (ci-dessous) écarte les nugu de ces cohortes.
  const kstYear = new Date(nowMs + 9 * 3600_000).getUTCFullYear()
  const kstMonth = new Date(nowMs + 9 * 3600_000).getUTCMonth() + 1
  const years = [
    ...new Set([
      kstYear - 3,
      kstYear - 2,
      kstYear - 1,
      kstYear,
      ...(kstMonth >= 11 ? [kstYear + 1] : []),
    ]),
  ]

  const members: { pageid: number; title: string }[] = []
  for (const y of years) {
    const cat = await fetchDebutCategory(y)
    if (cat.blocked) {
      result.blocked = true
      return result
    }
    members.push(...cat.members)
  }
  result.scanned = members.length

  const { data: known } = await supabase.from('debut_candidates').select('fandom_pageid')
  const knownIds = new Set((known ?? []).map((k) => k.fandom_pageid))
  const fresh = members.filter((m) => !knownIds.has(m.pageid))
  result.newPages = fresh.length

  if (fresh.length === 0) return result

  const [wikipediaNames, { data: existingGroups }] = await Promise.all([
    fetchWikipediaDebutNames(kstYear),
    supabase.from('groups').select('name'),
  ])
  const knownNames = new Set((existingGroups ?? []).map((g) => normalizeDebutName(g.name)))

  for (const page of fresh.slice(0, MAX_PARSES_PER_RUN)) {
    try {
      const { infobox, blocked } = await fetchInfobox(page.pageid)
      if (blocked) {
        result.blocked = true
        break
      }
      const fandomUrl = `https://kpop.fandom.com/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`

      // Pas d'infobox musicale (page membre/chanson) ou déjà en base → écarté.
      if (!infobox || !infobox.name || knownNames.has(normalizeDebutName(infobox.name))) {
        await supabase.from('debut_candidates').insert({
          fandom_pageid: page.pageid,
          page_title: page.title,
          status: 'dismissed',
          decided_at: new Date().toISOString(),
          payload: {
            reason: !infobox || !infobox.name ? 'no-infobox' : 'already-in-db',
          } as Json,
        })
        result.dismissed++
        continue
      }

      const ytVerified =
        infobox.youtubeHandle && opts.youtubeKey
          ? await verifyYouTubeHandle(infobox.youtubeHandle, opts.youtubeKey)
          : null
      const imageUrl = infobox.imageFile ? await resolveImageUrl(infobox.imageFile) : null

      const payload: DebutCandidatePayload = {
        name: infobox.name,
        debutDate: infobox.debutDate,
        label: infobox.label,
        members: infobox.members,
        youtubeHandle: infobox.youtubeHandle,
        instagram: infobox.instagram,
        imageUrl,
        wikipediaListed: wikipediaNames.has(normalizeDebutName(infobox.name)),
        ytVerified,
        fandomUrl,
      }

      // Gate = date concrète ET signal d'AUDIENCE réel : subs YouTube ≥ 10k OU
      // fans Deezer ≥ 5k (décision pure debutGateDecision — testée). On
      // abandonne « label déjà en base » (laissait passer tout nugu d'une
      // major → biais 2026). wikipediaListed reste au payload pour la revue
      // admin mais ne suffit plus. deezerFans est PERSISTÉ dans le payload :
      // la revue admin voit le signal qui a décidé.
      const deezerFanCount = await deezerFans(payload.name)
      payload.deezerFans = deezerFanCount
      const decision = debutGateDecision(payload, deezerFanCount)

      let groupId: string | null = null
      if (decision.autoCreate) {
        const createRes = await createFromPayload(supabase, payload)
        if ('groupId' in createRes) {
          groupId = createRes.groupId
          result.created.push(payload.name)
          // Étapes partiellement échouées (membres, source, event) : visibles
          // en scrape_log — le prochain run/clic admin RESUME (idempotent).
          for (const se of createRes.stepErrors) result.errors.push(`${payload.name}: ${se}`)
        } else {
          result.errors.push(`${payload.name}: ${createRes.error}`)
          result.pending.push(payload.name)
        }
      } else {
        result.pending.push(payload.name)
      }

      await supabase.from('debut_candidates').insert({
        fandom_pageid: page.pageid,
        page_title: page.title,
        status: groupId ? 'created' : 'pending',
        group_id: groupId,
        decided_at: groupId ? new Date().toISOString() : null,
        payload: payload as unknown as Json,
      })
    } catch (e) {
      result.errors.push(`${page.title}: ${String(e)}`)
    }
  }

  return result
}
