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
import { mentionsArtist } from '@/lib/scrapers/group-match'
import { optimizeImageBuffer } from '@/lib/images/optimize'
import { uploadWebpVerified } from '@/lib/images/upload'

type SupabaseClient = ReturnType<typeof createClient<Database>>

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '')

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

// Groupe parent (pour le titre fandom désambiguïsé) des solistes dont le groupe
// d'origine a quitté le roster → aucune row membre pour le dériver. Clé = slug du
// groupe solo. Étendre au besoin (ex-membres de légendes retirées).
const SOLO_PARENT_FALLBACK: Record<string, string> = {
  taeyeon: "Girls' Generation",
  // Dayoung : sa page fandom est « Dayoung (WJSN) », mais WJSN n'est pas au
  // roster — aucune row membre pour dériver le parent (2026-08-21).
  dayoung: 'WJSN',
}

/**
/**
 * La page retenue désigne-t-elle bien CETTE personne ?
 *
 * Garde indispensable : `pageimage` est l'image PRINCIPALE d'une page, et une
 * page de GROUPE en a toujours une (photo de concept, pochette, logo). Sans
 * cette vérification, « Jaeyoon SF9 » remonte la page « SF9 », catégorisée sous
 * SF9 donc acceptée par la seule garde de catégorie — et les sept membres de
 * SF9 se retrouvent avec le même concept photo (constat prod 2026-08-21 :
 * 210 membres partageaient 78 images).
 *
 * Match par MOTS ENTIERS sur le titre, avec plusieurs formes du nom : les
 * romanisations divergent (« Ahn Yujin » en base, page « An Yujin »), donc on
 * accepte le stage name, le vrai nom, ou le dernier mot du stage name.
 */
function pageIsAboutMember(pageTitle: string, stageName: string, realName: string | null): boolean {
  const needles = [stageName, realName, stageName.split(' ').at(-1) ?? ''].filter(
    (n): n is string => !!n && n.length > 1,
  )
  return needles.some((n) => mentionsArtist(pageTitle, n))
}

/**
 * Repli de résolution par RECHERCHE fandom quand les titres devinés échouent :
 * camelCase (« HeeJin »/« HaSeul »/« JinSoul » LOONA/ARTMS que `titleCase`
 * aplatit), romanisations divergentes, ou qualificateur à casse inattendue.
 * `generator=search` trouve la vraie page en un appel (+ pageimages/categories) ;
 * la garde de catégorie (page catégorisée sous le groupe) écarte les homonymes.
 * Réservé aux membres de GROUPE — un solo n'a pas de catégorie-groupe pour garder.
 */
async function searchFandomPhoto(
  stageName: string,
  groupName: string,
  groupKey: string,
  realName: string | null,
): Promise<string | undefined> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: `${stageName} ${groupName}`,
    gsrlimit: '6',
    prop: 'pageimages|categories',
    piprop: 'original',
    pilimit: 'max',
    cllimit: 'max',
  })
  try {
    const res = await fetch(`https://kpop.fandom.com/api.php?${params}`, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    })
    if (!res.ok) return undefined
    const json = (await res.json()) as FandomQueryResponse
    for (const page of Object.values(json.query?.pages ?? {})) {
      if (!page.original?.source) continue
      // Le titre doit désigner la PERSONNE, pas seulement appartenir au groupe.
      if (!page.title || !pageIsAboutMember(page.title, stageName, realName)) continue
      const cats = (page.categories ?? []).map((c) => norm(c.title))
      if (cats.some((c) => c.includes(groupKey))) return page.original.source
    }
  } catch {
    // silencieux : le repli échoue → le membre garde sa photo actuelle
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Phase 1 — images carrées de groupes, Spotify par ID
// ---------------------------------------------------------------------------

export interface GroupImagesSummary {
  total: number
  updated: number
  /** `slug (nom DB) ≠ nom Spotify` — lien probablement mal seedé, RIEN écrit.
      C'est un ÉTAT de la donnée à corriger à la main, pas une panne du run :
      il remonte par le check `spotify_link_mismatch` de /admin/health. */
  mismatches: string[]
  noLink: number
  /** id Spotify inconnu de l'API (artiste supprimé/fusionné) — par groupe. */
  notFound: number
  /** 5xx ou réponse illisible — transitoire, se rejoue au prochain run. */
  apiErrors: number
  /**
   * Run INTERROMPU (quota épuisé ou token refusé) : les groupes restants n'ont
   * même pas été tentés. Continuer la boucle ne ferait que brûler du quota —
   * le 429 de Spotify porte un `Retry-After` de plusieurs HEURES.
   */
  aborted: { reason: 'rate_limited' | 'auth'; retryAfterSec: number | null; skipped: number } | null
}

export async function refreshGroupImages(
  supabase: SupabaseClient,
  token: string,
  opts: { limit?: number } = {},
): Promise<GroupImagesSummary> {
  let query = supabase
    // name_aliases : le garde de nom doit connaître le hangul officiel, sinon
    // un artiste titré « 스텔라이브 » ne matchera jamais « StelLive ».
    .from('groups')
    .select('id, slug, name, name_aliases, links, image_url, image_checked_at')
    // Les moins récemment vérifiés d'abord, jamais-vérifiés en tête. Trier par
    // nom revenait à interroger Spotify sur les 268 mêmes groupes chaque jour
    // pour 0 à 4 images changées — et l'API a coupé 12 h 40 le 2026-08-21.
    .order('image_checked_at', { ascending: true, nullsFirst: true })
  if (opts.limit) query = query.limit(opts.limit)
  const { data: groups, error } = await query
  if (error) throw new Error(`groups select: ${error.message}`)

  const all = groups ?? []
  const summary: GroupImagesSummary = {
    total: all.length,
    updated: 0,
    mismatches: [],
    noLink: 0,
    notFound: 0,
    apiErrors: 0,
    aborted: null,
  }

  for (const [index, g] of all.entries()) {
    const links = g.links as Record<string, string> | null
    const artistId = parseSpotifyArtistId(links?.spotify)
    if (!artistId) {
      summary.noLink++
      continue
    }
    const res = await spotifyArtistById(artistId, token)
    if (!res.ok) {
      if (res.failure.fatal) {
        summary.aborted = {
          reason: res.failure.reason,
          retryAfterSec: res.failure.reason === 'rate_limited' ? res.failure.retryAfterSec : null,
          skipped: all.length - index,
        }
        break
      }
      if (res.failure.reason === 'not_found') summary.notFound++
      else summary.apiErrors++
      await sleep(200)
      continue
    }
    const artist = res.artist
    if (!spotifyNameMatches(g.name, artist.name, g.name_aliases ?? [])) {
      summary.mismatches.push(`${g.slug} (${g.name}) ≠ spotify:${artist.name}`)
      await sleep(200)
      continue
    }
    // L'horodatage est posé même quand rien ne change : c'est lui qui fait
    // tourner la file, pas le succès de la mise à jour.
    const patch: {
      image_url?: string
      spotify_followers?: number
      image_checked_at: string
    } = { image_checked_at: new Date().toISOString() }
    if (artist.image && artist.image !== g.image_url) patch.image_url = artist.image
    if (artist.followers != null) patch.spotify_followers = artist.followers
    const { error: upErr } = await supabase.from('groups').update(patch).eq('id', g.id)
    if (upErr) console.error(`refresh-images update ${g.slug}: ${upErr.message}`)
    else if (patch.image_url) summary.updated++
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
  /** Échecs PAR MEMBRE (téléchargement / optimisation / upload). */
  failures: number
  /** Appels MediaWiki qui ont JETÉ (réseau, DNS, TLS) — par lot de 5 membres. */
  batchFailures: number
  /** Réponses MediaWiki non-2xx autres que 403 (503 Cloudflare, 429, 500). */
  apiErrors: number
  /** Photos écartées car DÉJÀ portées par un autre membre (photo de groupe,
      pochette, logo d'émission) — un portrait n'appartient qu'à une personne. */
  sharedRejected: number
  /** api.php inaccessible (Cloudflare ?) : phase à re-router si persistant. */
  apiBlocked: boolean
}

interface FandomQueryResponse {
  query?: {
    normalized?: { from: string; to: string }[]
    redirects?: { from: string; to: string }[]
    pages?: Record<
      string,
      {
        title?: string
        original?: { source?: string }
        categories?: { title: string }[]
      }
    >
  }
}

const PHOTO_BUCKET = 'member-photos'

/**
 * `photo_source_key` → id du membre qui la porte, pour TOUT le roster.
 *
 * Sert à refuser d'écrire une image dÉJÀ portée par quelqu'un d'autre. Fandom
 * expose `pageimage` = image PRINCIPALE de la page ; quand la page d'un membre
 * n'a pas de portrait, c'est la photo de groupe (ou la pochette, ou le logo de
 * l'émission) qui remonte. Constat prod du 2026-08-21 : **210 membres sur 1 248
 * partageaient 78 images** — les 7 SF9 affichaient tous le même concept photo,
 * les 5 FANTASY BOYS le logo de leur émission. Un portrait n'appartient qu'à
 * une personne : c'est l'invariant, et il ne coûte qu'un Set.
 */
interface PhotoOwner {
  /** Identité de PERSONNE : `canonical_id` quand il existe, sinon l'id de row. */
  identity: string
  nameKey: string
}

async function loadPhotoOwners(supabase: SupabaseClient): Promise<Map<string, PhotoOwner>> {
  const owners = new Map<string, PhotoOwner>()
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from('members')
      .select('id, canonical_id, stage_name, photo_source_key')
      .not('photo_source_key', 'is', null)
      .range(from, from + 999)
    if (!data || data.length === 0) break
    for (const m of data) {
      if (!m.photo_source_key) continue
      owners.set(m.photo_source_key, {
        identity: m.canonical_id ?? m.id,
        nameKey: norm(m.stage_name),
      })
    }
    if (data.length < 1000) break
  }
  return owners
}

/**
 * Deux rows peuvent légitimement porter la même image : c'est la MÊME personne
 * sous deux appartenances (DK figure dans Seventeen ET dans l'unit DK X
 * Seungkwan). On l'accepte via `canonical_id`, et à défaut via l'égalité du nom
 * de scène — tous les doublons de personne n'ont pas encore leur lien canonique
 * (check `duplicate_person_candidates`). Deux homonymes de groupes différents
 * ne peuvent pas déclencher ce repli : il faudrait que leurs pages fandom
 * pointent la même image.
 */
function isSamePerson(owner: PhotoOwner, identity: string, nameKey: string): boolean {
  return owner.identity === identity || owner.nameKey === nameKey
}

/** Membres actifs SANS photo, les plus anciennement vérifiés d'abord. */
async function selectPhotolessMembers(supabase: SupabaseClient, limit: number) {
  const { data, error } = await supabase
    .from('members')
    .select(
      'id, canonical_id, stage_name, real_name, photo_url, photo_source_key, groups!inner(name, slug, is_solo)',
    )
    .is('photo_url', null)
    .eq('status', 'active')
    .order('photo_checked_at', { ascending: true, nullsFirst: true })
    .limit(limit)
  if (error) throw new Error(`members select (missing): ${error.message}`)
  return data ?? []
}

export async function refreshMemberPhotos(
  supabase: SupabaseClient,
  opts: { batch?: number; staleOnly?: boolean; groupId?: string } = {},
): Promise<MemberPhotosSummary> {
  const batchSize = opts.batch ?? 100
  // `staleOnly` : ne traiter que les membres JAMAIS sourcés fandom
  // (photo_source_key null) — ils gardent une vieille photo → incohérence d'ère
  // intra-groupe (Kim Chaewon vs le reste de LE SSERAFIM, Heejin/Haseul vs ARTMS).
  // Le runner one-off l'active pour combler toute la classe en un passage ; le
  // cron quotidien garde la rotation normale par ancienneté de vérification.
  let mq = supabase
    .from('members')
    .select(
      'id, canonical_id, stage_name, real_name, photo_url, photo_source_key, groups!inner(name, slug, is_solo)',
    )
  if (opts.staleOnly) mq = mq.is('photo_source_key', null)
  // Ciblage d'un groupe précis : photos immédiates à la création (round
  // 2026-07-18 — un nouveau groupe attendait la rotation ~100/j, avatars vides).
  if (opts.groupId) mq = mq.eq('group_id', opts.groupId)
  // PRIORITÉ AUX MEMBRES SANS PHOTO (retour Rudy 2026-08-21). La rotation par
  // ancienneté seule les laissait au fond de la file : le bouton « Relancer la
  // résolution photos » rendait « 0 photos résolues » alors qu'un passage ciblé
  // sur le même groupe en récupérait 5 sur 5 (BADVILLAIN — leurs pages fandom
  // existent). Une photo MANQUANTE est un trou visible ; une photo vieille de
  // deux jours ne l'est pas : les sans-photo passent donc d'abord, le reste de
  // la rotation remplit le budget restant.
  // ⚠ Ne JAMAIS réutiliser `mq` pour cette requête-ci : PostgrestFilterBuilder
  // MUTE l'objet (`is()` fait un `searchParams.append` puis `return this`).
  // Écrit ainsi le 2026-08-21 (14f5cd7), le `photo_url=is.null` restait collé
  // sur `mq` et repartait avec la rotation — `--stale` exécutait alors
  // `photo_source_key IS NULL AND photo_url IS NULL` (intersection vide depuis
  // que plus aucun membre actif n'est sans photo), donc l'outil de rattrapage
  // des photos d'ère était mort silencieusement.
  const missing =
    opts.groupId || opts.staleOnly ? [] : await selectPhotolessMembers(supabase, batchSize)

  const remaining = Math.max(0, batchSize - missing.length)
  const { data: rotation, error } = await mq
    .order('photo_checked_at', { ascending: true, nullsFirst: true })
    .limit(remaining)
  if (error) throw new Error(`members select: ${error.message}`)
  const seen = new Set(missing.map((m) => m.id))
  const members = [...missing, ...(rotation ?? []).filter((m) => !seen.has(m.id))]
  const photoOwners = await loadPhotoOwners(supabase)

  const summary: MemberPhotosSummary = {
    checked: 0,
    updated: 0,
    misses: 0,
    failures: 0,
    batchFailures: 0,
    apiErrors: 0,
    sharedRejected: 0,
    apiBlocked: false,
  }
  const now = new Date().toISOString()

  // Titre fandom conventionnel : « Stage Name (nom du groupe) » — vérifié sur
  // « Karina (aespa) », « Soyeon (i-dle) ». MediaWiki est SENSIBLE À LA CASSE
  // après la 1re lettre (« NingNing » ≠ page « Ningning » → 362 misses au
  // premier passage, classe repérée par Rudy sur aespa) : on demande aussi la
  // variante Title-case. Les misses gardent leur photo actuelle (self-host
  // kprofiles) et sortent de la rotation jusqu'au tour suivant.
  // Convention fandom réelle (R6, sondée le 2026-07-13) : le qualificatif
  // « (groupe) » n'existe QUE s'il y a collision de noms sur le wiki —
  // « Karina (aespa) » mais « Ningning », « An Yujin », « Jang Wonyoung »,
  // « Leeseo » au nom NU. On tente donc aussi le nom nu pour les membres de
  // groupes, mais un hit nu n'est accepté que si les CATÉGORIES de la page
  // confirment le groupe (sans ça, une rookie sans page hériterait de la
  // photo d'une homonyme célèbre).
  const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
  // Title-case mot-à-mot : « KANG DANIEL » → « Kang Daniel » (le titleCase simple
  // donne « Kang daniel », faux — MediaWiki est casse-sensible après la 1re lettre).
  const wordTitleCase = (s: string) =>
    s
      .split(' ')
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
      .join(' ')

  // Parents des SOLISTES (leur row membre dans un groupe non-solo) : la page
  // fandom d'un soliste est DÉSAMBIGUÏSÉE (« Jisoo (BLACKPINK) », « Taemin
  // (SHINee) ») ; le nom nu tombe sur une désambiguïsation OU redirige vers un
  // homonyme (Jisoo→Jisu, Soojin→Sujin — vérifié). On tape la page exacte.
  const soloParents = new Map<string, string[]>()
  if ((members ?? []).some((m) => m.groups.is_solo)) {
    const { data: memberships } = await supabase
      .from('members')
      .select('stage_name, groups!inner(name, is_solo)')
      .eq('groups.is_solo', false)
    for (const mm of memberships ?? []) {
      const k = norm(mm.stage_name)
      soloParents.set(k, [...(soloParents.get(k) ?? []), mm.groups.name])
    }
  }

  type Target = NonNullable<typeof members>[number] & { fandomTitles: string[] }
  const targets: Target[] = (members ?? []).map((m) => {
    // Candidats real_name (R8) : la page fandom porte parfois le VRAI nom plutôt
    // que le stage_name — « Sakura » → page « Miyawaki Sakura ». Le nom nu
    // real_name reste soumis à la garde de catégorie (comme stage_name nu).
    const rn = m.real_name?.trim()
    const realCands =
      rn && rn.toLowerCase() !== m.stage_name.toLowerCase()
        ? m.groups.is_solo
          ? [rn, titleCase(rn)]
          : [rn, titleCase(rn), `${rn} (${m.groups.name})`]
        : []
    return {
      ...m,
      fandomTitles: [
        ...new Set(
          m.groups.is_solo
            ? // Soliste : candidats DÉSAMBIGUÏSÉS d'abord (page exacte, sûre face
              // aux homonymes) puis « (singer) », puis le nom nu en repli.
              [
                ...[
                  ...(soloParents.get(norm(m.stage_name)) ?? []),
                  // Repli pour les solistes dont le groupe parent a quitté le
                  // roster (Taeyeon/SNSD retiré) → pas de row membre pour dériver
                  // le parent.
                  ...(SOLO_PARENT_FALLBACK[m.groups.slug]
                    ? [SOLO_PARENT_FALLBACK[m.groups.slug]]
                    : []),
                ].flatMap((p) => [
                  `${m.stage_name} (${p})`,
                  `${m.stage_name} (${p.toUpperCase()})`,
                ]),
                // « (singer) » en title-case mot-à-mot : le wiki écrit
                // « Yena (singer) » alors que la DB stocke « YENA ».
                `${wordTitleCase(m.stage_name)} (singer)`,
                `${m.stage_name} (singer)`,
                wordTitleCase(m.stage_name),
                m.stage_name,
                titleCase(m.stage_name),
                ...realCands,
              ]
            : [
                `${m.stage_name} (${m.groups.name})`,
                `${titleCase(m.stage_name)} (${m.groups.name})`,
                // Le wiki met parfois le qualificateur en CAPITALES
                // (« Kim Chaewon (LE SSERAFIM) ») alors que la DB stocke
                // « Le Sserafim ». MediaWiki n'insensibilise que la 1re lettre
                // du titre, pas le qualificateur → on demande la variante upper.
                `${m.stage_name} (${m.groups.name.toUpperCase()})`,
                m.stage_name,
                titleCase(m.stage_name),
                // « Ahn Yujin » vs page « An Yujin » (romanisations) : la
                // redirection « Yujin (IVE) » existe — dernier mot + groupe.
                ...(m.stage_name.includes(' ')
                  ? [`${titleCase(m.stage_name.split(' ').at(-1)!)} (${m.groups.name})`]
                  : []),
                ...realCands,
              ],
        ),
      ],
    }
  })

  // 5 membres/appel : jusqu'à ~9 titres chacun (real_name + variante upper du
  // qualificateur inclus) → 45, sous la limite MediaWiki de 50 titres/requête.
  for (let i = 0; i < targets.length; i += 5) {
    const batch = targets.slice(i, i + 5)
    const titles = batch.flatMap((t) => t.fandomTitles).join('|')
    // La réponse est PAGINÉE dès que categories/pageimages dépassent leurs
    // limites (pilimit, cllimit) : sans suivre `continue`, une partie des
    // pages arrive sans image (Ningning, R6). On merge toutes les tranches.
    const data: FandomQueryResponse = { query: { normalized: [], redirects: [], pages: {} } }
    try {
      let cont: Record<string, string> = {}
      for (let hop = 0; hop < 6; hop++) {
        const params = new URLSearchParams({
          action: 'query',
          format: 'json',
          redirects: '1',
          prop: 'pageimages|categories',
          piprop: 'original',
          pilimit: 'max',
          cllimit: 'max',
          titles,
          ...cont,
        })
        const res = await fetch(`https://kpop.fandom.com/api.php?${params}`, {
          headers: { 'User-Agent': UA, Accept: 'application/json' },
        })
        if (!res.ok) {
          // Un non-2xx qui n'est pas 403 n'incrémentait RIEN : une panne
          // MediaWiki (503, 429, 500) sortait de la boucle en silence, les
          // 100 membres du lot repartaient avec `photo_checked_at` rafraîchi
          // et le run était logué `ok` (audit 2026-08-21).
          if (res.status === 403) summary.apiBlocked = true
          else summary.apiErrors++
          console.error(`refresh-images fandom: HTTP ${res.status}`)
          break
        }
        const slice = (await res.json()) as FandomQueryResponse & {
          continue?: Record<string, string>
        }
        data.query!.normalized!.push(...(slice.query?.normalized ?? []))
        data.query!.redirects!.push(...(slice.query?.redirects ?? []))
        for (const [pid, page] of Object.entries(slice.query?.pages ?? {})) {
          const cur = data.query!.pages![pid]
          data.query!.pages![pid] = {
            ...cur,
            ...page,
            original: page.original ?? cur?.original,
            categories: [...(cur?.categories ?? []), ...(page.categories ?? [])],
          }
        }
        if (!slice.continue) break
        cont = slice.continue
      }
    } catch (e) {
      // Compté séparément de `failures` (par MEMBRE) : mélanger les deux
      // granularités rendait le seuil `failures > checked / 2` inatteignable.
      summary.batchFailures++
      console.error(`refresh-images fandom batch: ${e instanceof Error ? e.message : String(e)}`)
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
    const pageByTitle = new Map<string, { source: string; categories: string[]; title: string }>()
    for (const page of Object.values(data?.query?.pages ?? {})) {
      if (page.title && page.original?.source)
        pageByTitle.set(norm(page.title), {
          source: page.original.source,
          categories: (page.categories ?? []).map((c) => c.title),
          // Titre BRUT conservé : `norm()` écrase les frontières de mots, dont
          // la garde « la page désigne-t-elle la personne ? » a besoin.
          title: page.title,
        })
    }

    for (const m of batch) {
      // Override admin : une photo posée manuellement (éditeur /admin/images,
      // photo_source_key='admin') n'est jamais écrasée par le cron fandom.
      if (m.photo_source_key === 'admin') continue
      summary.checked++
      const groupKey = norm(m.groups.name)
      let source = m.fandomTitles
        .map((t) => {
          const hit = pageByTitle.get(finalTitle(t))
          if (!hit) return undefined
          // La page RÉSOLUE doit désigner la personne. `finalTitle` suit les
          // redirections : un titre désambiguïsé « X (Groupe) » qui redirige
          // vers la page du GROUPE ne subissait aucune garde (seuls les titres
          // nus passaient par la vérification de catégorie) et rapportait le
          // concept photo du groupe.
          if (!pageIsAboutMember(hit.title, m.stage_name, m.real_name)) return undefined
          // Titre NU d'un membre de groupe : exiger EN PLUS la catégorie du
          // groupe — elle départage les homonymes inter-groupes.
          const bare = !t.includes('(')
          if (bare && !m.groups.is_solo && !hit.categories.some((c) => norm(c).includes(groupKey)))
            return undefined
          return hit.source
        })
        .find((s): s is string => !!s)
      // Repli recherche fandom pour les membres de groupe encore non sourcés
      // (stale) : rattrape le camelCase/romanisations que les titres devinés
      // ratent (Heejin/Haseul ARTMS). Borné aux stale pour limiter les appels.
      if (!source && !m.groups.is_solo && !m.photo_source_key) {
        source = await searchFandomPhoto(m.stage_name, m.groups.name, groupKey, m.real_name)
      }
      // Image déjà portée par un AUTRE membre : c'est une photo de groupe, une
      // pochette ou un logo, pas un portrait. Mieux vaut pas de photo qu'une
      // grille où sept visages sont identiques.
      const owner = source ? photoOwners.get(source) : undefined
      if (source && owner && !isSamePerson(owner, m.canonical_id ?? m.id, norm(m.stage_name))) {
        summary.sharedRejected++
        // Nom de FICHIER wikia (« .../images/7/75/<fichier>/revision/latest?cb= »)
        // et non le dernier segment, qui vaut toujours « latest?cb=… ».
        console.error(
          `refresh-images shared photo ${m.groups.slug}/${m.stage_name}: ${
            /\/images\/[^/]+\/[^/]+\/([^/]+)/.exec(source)?.[1] ?? source
          }`,
        )
        source = undefined
      }
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
        // Les originaux fandom peuvent peser >10 Mo (cas SuA 17 Mo) : toujours
        // normaliser (≤800 px, webp) avant le bucket — Cloudinary fetch refuse
        // les sources trop lourdes et l'avatar s'affiche cassé.
        const optimized = await optimizeImageBuffer(bytes)
        const path = `${m.id}.webp`
        const up = await uploadWebpVerified(supabase, PHOTO_BUCKET, path, optimized)
        if (!up.ok) throw new Error(up.error)
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
        // Revendique la clé pour la suite du run : sans ça, les cinq membres
        // d'un même lot pourraient tous prendre la même photo de groupe avant
        // que la base ne l'ait enregistrée pour le premier.
        photoOwners.set(source, {
          identity: m.canonical_id ?? m.id,
          nameKey: norm(m.stage_name),
        })
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
