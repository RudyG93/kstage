/**
 * kpop.fandom.com (MediaWiki API) — détecteur primaire des debuts (R4-I).
 * Vérifié live le 2026-07-12 : Category:{YYYY}_debuts liste les groupes AVANT
 * leur debut (AEN, debut 2026-08-05, présent en juillet), et l'infobox porte
 * date/label/membres/SNS/image. api.php passe sans challenge en local ; un 403
 * (Cloudflare, possible depuis les IPs Vercel) est remonté via `blocked` —
 * jamais d'échec silencieux.
 */

const API = 'https://kpop.fandom.com/api.php'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

async function api<T>(
  params: Record<string, string>,
): Promise<{ data: T | null; blocked: boolean }> {
  const qs = new URLSearchParams({ ...params, format: 'json' })
  const res = await fetch(`${API}?${qs}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  })
  if (res.status === 403) return { data: null, blocked: true }
  if (!res.ok) return { data: null, blocked: false }
  return { data: (await res.json()) as T, blocked: false }
}

/** Pageids par recherche plein-texte (résolution d'un groupe déjà en base). */
export async function searchPageIds(term: string, limit = 5): Promise<number[]> {
  const { data } = await api<{ query?: { search?: { pageid: number }[] } }>({
    action: 'query',
    list: 'search',
    srsearch: term,
    srlimit: String(limit),
  })
  return data?.query?.search?.map((s) => s.pageid) ?? []
}

export interface CategoryMember {
  pageid: number
  title: string
}

/** Pages de la catégorie des debuts d'une année (namespace 0 uniquement). */
export async function fetchDebutCategory(
  year: number,
): Promise<{ members: CategoryMember[]; blocked: boolean }> {
  const { data, blocked } = await api<{
    query?: { categorymembers?: CategoryMember[] }
  }>({
    action: 'query',
    list: 'categorymembers',
    cmtitle: `Category:${year}_debuts`,
    cmnamespace: '0',
    cmlimit: '500',
  })
  return { members: data?.query?.categorymembers ?? [], blocked }
}

export interface FandomInfobox {
  name: string
  /** ISO date (YYYY-MM-DD) si la date de debut est concrète, sinon null. */
  debutDate: string | null
  label: string | null
  members: string[]
  youtubeHandle: string | null
  instagram: string | null
  /** Nom de fichier image de l'infobox (à résoudre via imageinfo). */
  imageFile: string | null
  /** Nature de la page : `{{Group infobox}}` vs `{{Artist infobox}}` —
      « members vide » ne veut PAS dire soliste (incident Yuqi/TOZ 2026-08-20 :
      groupes pré-debut sans lineup parsé créés is_solo à tort). */
  kind: 'group' | 'artist' | 'unknown'
}

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
}

/** « August 5, 2026 » (refs/liens wikitext tolérés autour) → « 2026-08-05 ». */
export function parseDebutDate(raw: string): string | null {
  const cleaned = raw
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>|<ref[^>]*\/>/g, '')
    .replace(/\[\[|\]\]/g, '')
  const m = /([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/.exec(cleaned)
  if (!m) return null
  const month = MONTHS[m[1].toLowerCase()]
  if (!month) return null
  return `${m[3]}-${String(month).padStart(2, '0')}-${String(Number(m[2])).padStart(2, '0')}`
}

/** Valeur d'un champ d'infobox : de `|field =` jusqu'au prochain `|xxx =` de premier niveau. */
function field(wikitext: string, name: string): string | null {
  const re = new RegExp(
    `\\|\\s*${name}\\s*=\\s*([\\s\\S]*?)(?=\\n\\s*\\|\\s*[a-z_]+\\s*=|\\n\\}\\})`,
    'i',
  )
  const m = re.exec(wikitext)
  return m ? m[1].trim() : null
}

const stripMarkup = (s: string) =>
  s
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>|<ref[^>]*\/>/g, '')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, '$1')
    .replace(/'''|''/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Champ label/agency d'infobox → agence(s) COURANTE(S) lisible(s).
 *
 * Incident Yves 2026-08-20 : le champ liste l'HISTORIQUE des agences séparées
 * par `<br>` avec périodes `{{small|(2017–2023)}}` — stripMarkup jetait les
 * périodes et collait les noms (« Paix Per Mil GOLDEN MOON BlockBerryCreative
 * Hunus Entertainment »). Même classe : marqueurs de marché `'''KR:'''` non
 * nettoyés (x-in, pow, trendz…).
 *
 * Règles : segments par `<br>`/sauts de ligne ; si des marqueurs de marché
 * existent, ne garder que la section KR (marché principal) ; si des périodes
 * existent, ne garder que les segments « present » — sinon le premier ;
 * plusieurs agences courantes → jointes par « · ».
 */
export function parseAgency(raw: string): string | null {
  // Section KR d'abord (le raw entier, avant découpe) : «'''KR:''' A <br> B '''JP:''' C ».
  const krMatch = /'''\s*KR\s*:?\s*'''\s*:?([\s\S]*?)(?='''\s*[A-Z]{2}\s*:?\s*'''|$)/i.exec(raw)
  const scoped = krMatch ? krMatch[1] : raw
  const segments = scoped
    .split(/<br\s*\/?>|\n/i)
    .map((seg) => ({
      // « present » détecté AVANT stripMarkup ({{small|(2024–present)}} serait jeté).
      current: /present/i.test(seg),
      // Préfixe de marché toléré : « (Korea; 2018–2021) » (cas réel IZ*ONE) —
      // exiger l'année collée à la parenthèse re-collait tout l'historique.
      dated: /\([^)]*\d{4}[\s\S]*?\)|present/i.test(seg),
      name: stripMarkup(seg),
    }))
    .filter((s) => s.name)
  if (segments.length === 0) return null
  const anyDated = segments.some((s) => s.dated)
  const kept = anyDated ? segments.filter((s) => s.current) : segments
  const picked = kept.length > 0 ? kept : [segments[0]]
  return picked.map((s) => s.name).join(' · ') || null
}

/**
 * Nature de la page par son template d'infobox — VÉRIFIÉ sur le wikitext réel
 * (2026-08-20) : kpop.fandom utilise `{{Infobox musical artist}}` pour les
 * GROUPES (aespa, TOZ — malgré le nom) et `{{Infobox person}}` pour les
 * personnes (Yves, pages membres). Les templates « Group/Artist infobox »
 * imaginés initialement n'existent pas sur ce wiki.
 */
export function detectInfoboxKind(wikitext: string): FandomInfobox['kind'] {
  if (/\{\{Infobox person/i.test(wikitext)) return 'artist'
  if (/\{\{Infobox (?:musical artist|group)/i.test(wikitext)) return 'group'
  return 'unknown'
}

/**
 * Parse l'infobox d'une page groupe/soliste. Null si la page n'a pas
 * d'infobox musicale (pages membres/chansons mélangées dans la catégorie).
 */
export async function fetchInfobox(
  pageid: number,
): Promise<{ infobox: FandomInfobox | null; blocked: boolean }> {
  const { data, blocked } = await api<{ parse?: { wikitext?: { '*': string } } }>({
    action: 'parse',
    pageid: String(pageid),
    prop: 'wikitext',
  })
  if (blocked || !data?.parse?.wikitext?.['*']) return { infobox: null, blocked }
  const wt = data.parse.wikitext['*']
  if (!/\{\{(?:Group |Artist |Musical artist |)infobox/i.test(wt) && !/\|\s*debut\s*=/i.test(wt)) {
    return { infobox: null, blocked: false }
  }
  const kind = detectInfoboxKind(wt)

  const membersRaw = field(wt, 'current') ?? field(wt, 'members')
  const members = membersRaw
    ? [...membersRaw.matchAll(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g)]
        .map((m) => m[1].trim())
        .filter((m) => m && !/^category:/i.test(m))
    : []

  const nameRaw = field(wt, 'name')
  const debutRaw = field(wt, 'debut')
  const labelRaw = field(wt, 'label') ?? field(wt, 'agency')
  const sns = `${field(wt, 'sns') ?? ''}\n${wt.slice(0, 4000)}`
  const imageRaw = field(wt, 'image')

  return {
    blocked: false,
    infobox: {
      name: nameRaw ? stripMarkup(nameRaw) : '',
      debutDate: debutRaw ? parseDebutDate(debutRaw) : null,
      label: labelRaw ? parseAgency(labelRaw) : null,
      members,
      kind,
      youtubeHandle: /\{\{YouTube@?\|([^}|]+)/i.exec(sns)?.[1]?.trim() ?? null,
      instagram: /\{\{Instagram\|([^}|]+)/i.exec(sns)?.[1]?.trim() ?? null,
      imageFile: imageRaw
        ? (/([^\n|[\]{}]+\.(?:png|jpe?g|webp))/i.exec(imageRaw)?.[1]?.trim() ?? null)
        : null,
    },
  }
}

/** URL directe (static.wikia) d'un fichier image de l'infobox. */
export async function resolveImageUrl(imageFile: string): Promise<string | null> {
  const { data } = await api<{
    query?: { pages?: Record<string, { imageinfo?: { url?: string }[] }> }
  }>({
    action: 'query',
    titles: `File:${imageFile}`,
    prop: 'imageinfo',
    iiprop: 'url',
  })
  const pages = Object.values(data?.query?.pages ?? {})
  return pages[0]?.imageinfo?.[0]?.url ?? null
}
