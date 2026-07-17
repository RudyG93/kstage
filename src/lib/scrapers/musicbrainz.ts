// Client MusicBrainz (ws/2) — enrichissement BEST-EFFORT des créations de
// groupes (Lot L 2026-07-17) : liens officiels (réseaux + streaming) et
// membres/birthdays. Règles d'usage MB : User-Agent identifiant obligatoire,
// ≤ 1 req/s → mbFetch sérialise avec un throttle.
//
// Réalités des données (vérifiées sur aespa, 2026-07-17) : les membres des
// groupes k-pop y sont souvent nommés en HANGUL (카리나) avec le romanisé en
// `sort-name` (KARINA) — le matching passe par les deux ; le birthday est le
// `life-span.begin` du record Person du membre (fetch séparé par membre).

import { normalize } from '@/lib/scrapers/group-match'

const MB_API = 'https://musicbrainz.org/ws/2'
const MB_UA = 'KStage/1.0 (https://kstage.vercel.app)'
const THROTTLE_MS = 1100
/** Au-delà, on renonce aux birthdays plutôt que de bloquer la création. */
const MAX_MEMBER_LOOKUPS = 12

let lastFetchAt = 0
async function mbFetch(path: string): Promise<unknown> {
  const wait = lastFetchAt + THROTTLE_MS - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastFetchAt = Date.now()
  const res = await fetch(`${MB_API}${path}`, { headers: { 'User-Agent': MB_UA } })
  if (!res.ok) throw new Error(`musicbrainz ${res.status} on ${path}`)
  return res.json()
}

// ——— Parsers purs (testés sur des réponses réelles trimées) ————————————————

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' ? (v as Json) : {})
const str = (v: unknown): string => (typeof v === 'string' ? v : '')

/** Match STRICT du résultat de recherche : score ≥ 90 ET nom normalisé égal. */
export function pickArtistMatch(
  searchJson: unknown,
  wantedName: string,
): { id: string; name: string; type: string } | null {
  const artists = (obj(searchJson).artists as unknown[] | undefined) ?? []
  const wanted = normalize(wantedName)
  for (const raw of artists) {
    const a = obj(raw)
    const score = typeof a.score === 'number' ? a.score : 0
    if (score < 90) continue
    const name = str(a.name)
    const aliases = ((a.aliases as unknown[] | undefined) ?? []).map((al) => str(obj(al).name))
    if (
      normalize(name) === wanted ||
      normalize(str(a['sort-name'])) === wanted ||
      aliases.some((al) => normalize(al) === wanted)
    ) {
      return { id: str(a.id), name, type: str(a.type) }
    }
  }
  return null
}

/** Domaine → clé `groups.links` supportée par LinksBar. Ordre = priorité. */
const DOMAIN_TO_KEY: [RegExp, string][] = [
  [/open\.spotify\.com/, 'spotify'],
  [/music\.apple\.com/, 'apple_music'],
  [/music\.youtube\.com/, 'youtube_music'],
  [/(www\.)?deezer\.com/, 'deezer'],
  [/(listen\.)?tidal\.com/, 'tidal'],
  [/soundcloud\.com/, 'soundcloud'],
  [/(www\.)?youtube\.com/, 'youtube'],
  [/instagram\.com/, 'instagram'],
  [/(twitter|x)\.com/, 'twitter'],
  [/tiktok\.com/, 'tiktok'],
  [/weverse\.io/, 'weverse'],
  [/facebook\.com/, 'facebook'],
  [/weibo\.com/, 'weibo'],
]

/** url-rels → Record<clé links, url> (première URL par clé — MB liste des doublons régionaux). */
export function extractLinks(artistJson: unknown): Record<string, string> {
  const links: Record<string, string> = {}
  const rels = (obj(artistJson).relations as unknown[] | undefined) ?? []
  for (const raw of rels) {
    const r = obj(raw)
    if (str(r['target-type']) !== 'url') continue
    const url = str(obj(r.url).resource)
    if (!url) continue
    for (const [re, key] of DOMAIN_TO_KEY) {
      if (re.test(url) && !links[key]) links[key] = url
    }
  }
  return links
}

export interface MbMemberRef {
  artistId: string
  /** Nom MB (souvent hangul). */
  name: string
}

/** Relations « member of band » ACTUELLES (non terminées) du groupe. */
export function extractCurrentMembers(artistJson: unknown): MbMemberRef[] {
  const rels = (obj(artistJson).relations as unknown[] | undefined) ?? []
  const out: MbMemberRef[] = []
  for (const raw of rels) {
    const r = obj(raw)
    if (str(r['target-type']) !== 'artist' || str(r.type) !== 'member of band') continue
    if (r.ended === true) continue
    const a = obj(r.artist)
    const id = str(a.id)
    if (id) out.push({ artistId: id, name: str(a.name) })
  }
  return out
}

export interface MbPerson {
  name: string
  sortName: string
  /** YYYY-MM-DD complet uniquement (une année seule n'est pas un birthday). */
  birthday: string | null
}

export function parsePerson(personJson: unknown): MbPerson {
  const p = obj(personJson)
  const begin = str(obj(p['life-span']).begin)
  return {
    name: str(p.name),
    sortName: str(p['sort-name']),
    birthday: /^\d{4}-\d{2}-\d{2}$/.test(begin) ? begin : null,
  }
}

// ——— Orchestration réseau ———————————————————————————————————————————————————

export interface MbEnrichment {
  links: Record<string, string>
  members: MbPerson[]
}

/**
 * Recherche + lookup complet d'un artiste par nom. null si aucun match
 * CONFIANT (score ≥ 90 + nom normalisé égal) — on n'enrichit jamais sur un
 * match ambigu. Les erreurs réseau REMONTENT (l'appelant les met en stepErrors).
 */
export async function fetchMbEnrichment(name: string): Promise<MbEnrichment | null> {
  const search = await mbFetch(
    `/artist?query=artist:${encodeURIComponent(`"${name}"`)}&fmt=json&limit=5`,
  )
  const match = pickArtistMatch(search, name)
  if (!match) return null

  const artist = await mbFetch(`/artist/${match.id}?inc=url-rels+artist-rels&fmt=json`)
  const links = extractLinks(artist)

  const members: MbPerson[] = []
  for (const ref of extractCurrentMembers(artist).slice(0, MAX_MEMBER_LOOKUPS)) {
    try {
      members.push(parsePerson(await mbFetch(`/artist/${ref.artistId}?fmt=json`)))
    } catch {
      // Un membre qui échoue ne condamne pas les autres.
    }
  }
  return { links, members }
}
