/**
 * Découverte de MV par la DISCOGRAPHIE fandom (nuit 2026-08-21).
 *
 * Problème résolu — constat prod : la chaîne YouTube « officielle » d'un
 * groupe ne contient souvent AUCUN MV. Cas d'école OURBIRTHDAY (debut
 * 19/08/2026) : 84 uploads de Shorts et contenus quotidiens sur sa chaîne,
 * pendant que son MV « SQUEEZY » vit sur la chaîne **JYP Entertainment**.
 * Scraper sa chaîne mille fois n'aurait jamais rien donné — c'est pour ça que
 * le bouton « relancer » de /admin/health ne résolvait rien.
 *
 * L'autre chemin (découverte par `search.list`) coûte 100 units par requête
 * sur un quota de recherche quotidien étroit, épuisé dès qu'on l'utilise pour
 * de bon (429 constaté le 21/08). Il ne peut pas être la réponse de masse.
 *
 * Ici : les pages fandom de singles/albums portent les **liens YouTube directs
 * des MV**, quelle que soit la chaîne qui les héberge. On lit la discographie
 * du groupe (gratuit), on en extrait les videoIds, et on laisse le pipeline
 * existant (`scrapeGroup` avec `uploads` injectés) appliquer TOUS ses gates :
 * titre officiel, appartenance au groupe, durée ≥ 75 s, dédup ±14 j, slug,
 * mv_kind. Coût YouTube : 1 unit par lot de 50 vidéos.
 */

const API = 'https://kpop.fandom.com/api.php'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

/** Pages de discographie visitées par groupe — borne les requêtes fandom. */
const MAX_RELEASE_PAGES = 18

async function wikitext(params: Record<string, string>): Promise<string | null> {
  const qs = new URLSearchParams({ ...params, action: 'parse', prop: 'wikitext', format: 'json' })
  try {
    const res = await fetch(`${API}?${qs}`, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { parse?: { wikitext?: { '*': string } } }
    return data.parse?.wikitext?.['*'] ?? null
  } catch {
    return null
  }
}

/**
 * Titres des pages de sorties (singles, albums, EP) listées dans la section
 * Discography d'une page groupe. Les sections voisines (Filmography, Trivia,
 * Members…) sont exclues : elles lient des émissions et des personnes.
 */
export function parseDiscographyPages(wt: string): string[] {
  // Section « ==Discography== » jusqu'au prochain titre de niveau 2.
  const start = /^==\s*Discography\s*==/im.exec(wt)
  if (!start) return []
  const rest = wt.slice(start.index + start[0].length)
  const end = /^==[^=]/m.exec(rest)
  const section = end ? rest.slice(0, end.index) : rest

  const pages: string[] = []
  for (const m of section.matchAll(/\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]/g)) {
    const title = m[1].trim()
    // Liens de catégorie/fichier/interwiki : jamais des pages de sortie.
    if (!title || /^(category|file|image|w:|:)/i.test(title)) continue
    if (!pages.includes(title)) pages.push(title)
  }
  return pages
}

/** videoIds YouTube cités dans un wikitext (watch?v=, youtu.be, embed). */
export function parseYouTubeIds(wt: string): string[] {
  const ids: string[] = []
  const re =
    /(?:youtube\.com\/(?:watch\?(?:[^"\s]*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/g
  for (const m of wt.matchAll(re)) {
    if (!ids.includes(m[1])) ids.push(m[1])
  }
  return ids
}

export interface DiscographyScan {
  /** videoIds trouvés sur les pages de sorties (ordre de découverte). */
  videoIds: string[]
  /** Pages de sorties visitées (trace pour l'admin/scrape_log). */
  pages: string[]
  /** Page groupe introuvable ou sans section Discography. */
  reason: string | null
}

/**
 * Scanne la discographie fandom d'un groupe et renvoie les videoIds cités.
 * `pageTitle` = titre exact de la page fandom (ex. « OURBIRTHDAY »).
 */
export async function scanFandomDiscography(pageTitle: string): Promise<DiscographyScan> {
  const groupWt = await wikitext({ page: pageTitle })
  if (!groupWt) return { videoIds: [], pages: [], reason: 'page fandom introuvable' }

  const releasePages = parseDiscographyPages(groupWt).slice(0, MAX_RELEASE_PAGES)
  if (releasePages.length === 0) {
    // Certaines pages (rookies) n'ont pas encore de section Discography mais
    // citent déjà le MV dans le corps : on retombe sur la page groupe.
    const inline = parseYouTubeIds(groupWt)
    return {
      videoIds: inline,
      pages: [],
      reason: inline.length === 0 ? 'aucune sortie listée ni lien YouTube' : null,
    }
  }

  const videoIds: string[] = []
  const visited: string[] = []
  for (const page of releasePages) {
    const wt = await wikitext({ page })
    if (!wt) continue
    visited.push(page)
    for (const id of parseYouTubeIds(wt)) {
      if (!videoIds.includes(id)) videoIds.push(id)
    }
  }
  // Liens cités directement sur la page groupe (MV mis en avant hors discographie).
  for (const id of parseYouTubeIds(groupWt)) {
    if (!videoIds.includes(id)) videoIds.push(id)
  }
  return { videoIds, pages: visited, reason: videoIds.length === 0 ? 'aucun lien MV' : null }
}
