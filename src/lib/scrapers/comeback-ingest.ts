// Cœur partagé des sources de comebacks « annoncés » (le futur du calendrier) :
// matching nom→groupe + insert idempotent en `type='release'`. Extrait de
// kpopofficial.ts (P0.7) pour qu'une 2ᵉ source (Wikipedia) le réutilise sans
// dupliquer la logique ni risquer une dérive de taxonomie.
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { isPlaceholderTitle } from '@/lib/health/checks'

type EventStatus = Database['public']['Enums']['event_status']
type SupabaseClient = ReturnType<typeof createClient<Database>>

export interface GroupRef {
  id: string
  slug: string
  name: string
}

export interface ParsedComeback {
  artist: string
  title: string
  sourceUrl: string
  startAt: string // UTC ISO
  status: EventStatus
  imageUrl: string | null
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

// Variantes normalisées non couvertes par la normalisation simple.
// "G-IDLE" / "GIDLE" / "(G)I-DLE" normalisent tous en "gidle" → on les mappe
// vers le slug actuel `idle`. "I-DLE" normalise en "idle" et matche déjà.
const GROUP_ALIASES: Record<string, string> = {
  gidle: 'idle',
}

/** Matche un nom d'artiste scrapé vers un de nos groupes suivis, sinon null. */
export function matchGroup(artist: string, groups: readonly GroupRef[]): GroupRef | null {
  const key = normalize(artist)
  if (!key) return null
  for (const g of groups) {
    if (normalize(g.name) === key || normalize(g.slug) === key) return g
  }
  const aliasSlug = GROUP_ALIASES[key]
  if (aliasSlug) return groups.find((g) => g.slug === aliasSlug) ?? null
  return null
}

// Suffixes d'édition accolés au nom : « aespa (JP) », « ATEEZ (JP) »…
// « KR » manquait : la branche suivante lit alors « KR » comme un NOM DE
// GROUPE entre parenthèses, ne trouve rien, et le comeback est jeté sans un
// mot. Les éditions coréennes sont annoncées comme les autres.
const EDITION_SUFFIX_RE =
  /\s*\((JP|Japan|Japanese|KR|Korea|Korean|CN|China|Chinese|US|EN|English|Virtual)\)\s*$/i

/**
 * Matching élargi (P0.5) — récupère 3 patterns en plus du match exact :
 * 1. Suffixe d'édition : « aespa (JP) » → aespa.
 * 2. Collab « A x B x C » → un event PAR groupe en DB (retour pluriel).
 * 3. Solo de membre « HAN (Stray Kids) » → rattaché au groupe parent.
 */
export function matchGroups(artist: string, groups: readonly GroupRef[]): GroupRef[] {
  const direct = matchGroup(artist, groups)
  if (direct) return [direct]

  const stripped = artist.replace(EDITION_SUFFIX_RE, '')
  if (stripped !== artist) {
    const m = matchGroup(stripped, groups)
    if (m) return [m]
  }

  // Collab : « A x B », « A X B », « A × B ». ≥2 composants requis.
  const parts = artist.split(/\s+[x×]\s+/i)
  if (parts.length >= 2) {
    const matched = parts
      .map((p) => matchGroup(p.replace(EDITION_SUFFIX_RE, ''), groups))
      .filter((g): g is GroupRef => g !== null)
    if (matched.length > 0) {
      return [...new Map(matched.map((g) => [g.id, g])).values()]
    }
  }

  // Solo de membre : « NAME (GROUP) ». Le soliste D'ABORD — s'il a sa propre
  // fiche au roster, la sortie est la sienne : l'attribuer au groupe parent
  // la posait sur la mauvaise page ET la dupliquait au calendrier de qui suit
  // les deux. Le parent ne sert que de repli, pour un membre sans fiche.
  const paren = artist.match(/^(.+?)\(([^)]+)\)\s*$/)
  if (paren) {
    const soliste = matchGroup(paren[1], groups)
    if (soliste) return [soliste]
    const parent = matchGroup(paren[2], groups)
    if (parent) return [parent]
  }

  return []
}

/**
 * Matche + insère une liste de comebacks parsés (depuis n'importe quelle source)
 * en `type='release'`. Idempotent par (source_url, group_id) : une collab insère
 * un event par groupe matché, tous avec la même source_url ; un re-scrape ne
 * duplique pas. Ne touche pas `last_scraped_at` (responsabilité de l'appelant).
 *
 * `opts.crossSourceDedupeDays` (P0.7, élargi 2026-07-11) : évite les doublons
 * calendrier quand le même comeback est annoncé deux fois — par une autre
 * source OU par la même source sous deux URLs différentes (kpopofficial poste
 * une entrée placeholder « Comeback with Full Album in July » puis l'entrée
 * album finalisée : 2 source_url distincts, même groupe à ±1 j — doublon réel
 * fromis_9 du 2026-07-08, cf. SCRAPING.md §3.15). Avant d'insérer, on skippe
 * s'il existe déjà une release pour ce groupe à ±N jours, peu importe la
 * source. Tradeoff assumé : deux vraies releases distinctes d'un même groupe
 * à < N jours seraient fusionnées (rare, déjà accepté cross-source).
 */
/** Row near-dup existante, pour la décision de fusion. */
export type NearDupRow = {
  id: string
  t: number
  status: string
  imageUrl: string | null
  title: string
}

/**
 * Upgrade de TITRE (round 2026-07-18, cas OURBIRTHDAY) : l'ingest debuts pose
 * « {groupe} debut » en placeholder ; quand la source apporte le vrai nom du
 * single, l'event existant doit le prendre — avant ce fix, la fusion near-dup
 * ne touchait jamais title et le placeholder restait pour toujours (6 events
 * en prod : V8, Keyveatz, ASCENDER, VAYONN, OURBIRTHDAY, AEN). Pur, testé.
 */
/**
 * Titre qui DÉCRIT le format au lieu de nommer la sortie — « NCT 127 7th Full
 * Album (2026) », « SF9 2nd Album (2026) », « 82MAJOR Comeback Coming Soon ».
 *
 * kpopofficial publie l'annonce avant que le label ne révèle le nom, puis
 * RENOMME sa page une fois l'album titré : `…/nct-127-comeback-2026/` répond
 * 301 vers `…/nct-127-blingy/` et la page s'intitule « NCT 127 7th Album –
 * BLINGY (2026) ». Le cron voyait donc bien la correction chaque matin, mais
 * `shouldUpgradeTitle` ne connaissait qu'une seule forme de placeholder,
 * « {groupe} debut », et laissait le descripteur en place indéfiniment
 * (signalé par Rudy le 2026-08-22 ; 6 rows en prod).
 *
 * La règle est « le titre se TERMINE par un mot de format » — pas « le titre
 * n'a pas de tiret » : les entrées Wikipedia sont des noms nus parfaitement
 * valides (« Mark on Me », « Blue Mode », « This & That »), et 133 des 138
 * entrées fandom n'ont pas de tiret non plus.
 */
const YEAR_SUFFIX_RE = /\s*\(\d{4}\)\s*$/
const FORMAT_TAIL_RE =
  /\b(?:full|mini|digital|studio|japanese|japan|korean|chinese|english|pre-?release|special|repackage)?\s*(?:album|single|ep|repackage|mixtape)\s*$/i
const COMING_SOON_RE = /\bcomeback\s+coming\s+soon\b/i

export function isUntitledRelease(title: string): boolean {
  const bare = title.replace(YEAR_SUFFIX_RE, '').trim()
  if (!bare) return false
  if (COMING_SOON_RE.test(bare)) return true
  return FORMAT_TAIL_RE.test(bare)
}

/** Placeholder au sens large : « {groupe} debut » OU descripteur de format. */
export function isPlaceholderRelease(title: string, groupName: string): boolean {
  return isPlaceholderTitle(title, groupName) || isUntitledRelease(title)
}

export function shouldUpgradeTitle(
  nearTitle: string,
  cbTitle: string | null | undefined,
  groupName: string,
): boolean {
  return (
    !!cbTitle &&
    isPlaceholderRelease(nearTitle, groupName) &&
    !isPlaceholderRelease(cbTitle, groupName)
  )
}

/**
 * Décision near-dup (Phase 3 Lot 4, « fusion des annonces plus précises ») —
 * pure, testable :
 *   - aucun near dans la fenêtre → 'insert' ;
 *   - candidat `confirmed` (heure exacte) vs near `tentative` (minuit KST
 *     technique) → { upgradeId } : on PROMEUT l'event existant au lieu de
 *     jeter la précision (la tentative wikipedia restait figée quand
 *     kpopofficial arrivait avec l'heure) ;
 *   - sinon 'skip' (comportement historique).
 * Idempotent : au run suivant le near est `confirmed` → 'skip'.
 */
export function resolveNearDup(
  candidate: { startAt: string; status: string },
  nears: readonly NearDupRow[],
  windowMs: number,
): 'insert' | 'skip' | { upgradeId: string; imageUrl: string | null } {
  const t = Date.parse(candidate.startAt)
  const near = nears.find((n) => Math.abs(n.t - t) <= windowMs)
  if (!near) return 'insert'
  if (candidate.status === 'confirmed' && near.status === 'tentative') {
    return { upgradeId: near.id, imageUrl: near.imageUrl }
  }
  return 'skip'
}

export async function ingestComebacks(
  entries: readonly ParsedComeback[],
  sourceId: string,
  groups: readonly GroupRef[],
  supabase: SupabaseClient,
  opts: { crossSourceDedupeDays?: number } = {},
): Promise<{ matched: number; inserted: number; skipped: number; upgraded: number }> {
  let matched = 0
  let inserted = 0
  let skipped = 0
  let upgraded = 0

  // Matching pur d'abord : une ligne candidate par (entrée, groupe matché).
  const candidates: { cb: ParsedComeback; group: GroupRef }[] = []
  for (const cb of entries) {
    for (const group of matchGroups(cb.artist, groups)) {
      matched++
      candidates.push({ cb, group })
    }
  }
  if (candidates.length === 0) return { matched, inserted, skipped, upgraded }

  // Batching (2026-07-11) : l'ancienne boucle faisait 1-2 allers-retours
  // Supabase PAR candidat (wikipedia parse ~200 entrées → centaines de
  // requêtes séquentielles par run, falaise de timeout à mesure que la
  // couverture grandit). Deux pré-fetch groupés + décision en mémoire +
  // insert par paquets — même pattern que le pipeline YouTube (§2).
  const urls = [...new Set(candidates.map((c) => c.cb.sourceUrl))]
  const groupIds = [...new Set(candidates.map((c) => c.group.id))]

  // 1) Idempotence (source_url, group_id) — sans filtre de type, comme l'eq
  //    unitaire d'origine.
  const { data: existingRows } = await supabase
    .from('events')
    .select('source_url, group_id')
    .in('source_url', urls)
    .in('group_id', groupIds)
  const existing = new Set((existingRows ?? []).map((r) => `${r.source_url}|${r.group_id}`))

  // 2) Fenêtre near-dup : toutes les releases des groupes concernés dans
  //    l'enveloppe [min-N j, max+N j] des candidats, indexées par groupe.
  //    id/status/image projetés pour la FUSION (upgrade tentative→confirmed).
  const nearByGroup = new Map<string, NearDupRow[]>()
  if (opts.crossSourceDedupeDays) {
    const ms = opts.crossSourceDedupeDays * 86_400_000
    const times = candidates.map((c) => Date.parse(c.cb.startAt)).filter(Number.isFinite)
    if (times.length > 0) {
      const lo = new Date(Math.min(...times) - ms).toISOString()
      const hi = new Date(Math.max(...times) + ms).toISOString()
      const { data: nearRows } = await supabase
        .from('events')
        .select('id, group_id, start_at, status, image_url, title')
        .eq('type', 'release')
        // Pas de filtre source : la fenêtre couvre aussi les entrées de la
        // MÊME source sous une autre URL (placeholder vs album finalisé,
        // SCRAPING.md §3.15).
        .in('group_id', groupIds)
        .gte('start_at', lo)
        .lte('start_at', hi)
      for (const r of nearRows ?? []) {
        const list = nearByGroup.get(r.group_id) ?? []
        list.push({
          id: r.id,
          t: Date.parse(r.start_at),
          status: r.status,
          imageUrl: r.image_url,
          title: r.title,
        })
        nearByGroup.set(r.group_id, list)
      }
    }
  }

  // Décision en mémoire. Les candidats retenus alimentent les sets au fil de
  // l'eau : l'intra-run se dédup comme le faisait la boucle séquentielle
  // (le 2ᵉ passage voyait l'insert du 1ᵉʳ en DB).
  type EventInsert = Database['public']['Tables']['events']['Insert']
  const rows: EventInsert[] = []
  for (const { cb, group } of candidates) {
    if (existing.has(`${cb.sourceUrl}|${group.id}`)) {
      skipped++
      continue
    }
    if (opts.crossSourceDedupeDays) {
      const ms = opts.crossSourceDedupeDays * 86_400_000
      const nears = nearByGroup.get(group.id) ?? []
      const decision = resolveNearDup(cb, nears, ms)
      if (decision === 'skip') {
        // Même en skip, un near au titre PLACEHOLDER prend le vrai titre de la
        // source (« OURBIRTHDAY debut » → nom officiel du single). Nécessaire
        // ici car le debut ingest pose status confirmed → jamais d'upgrade
        // start_at/status, donc jamais l'occasion de corriger le titre.
        const t = Date.parse(cb.startAt)
        const near = nears.find((n) => n.id && Math.abs(n.t - t) <= ms)
        if (near && shouldUpgradeTitle(near.title, cb.title, group.name)) {
          const { error: tErr } = await supabase
            .from('events')
            .update({
              title: cb.title,
              // `source_url` suit le titre : quand kpopofficial nomme l'album,
              // il RENOMME sa page et l'ancienne URL ne répond plus qu'en 301.
              // Laisser la clé pointer une URL morte condamnerait la row à
              // dépendre du near-dup pour l'éternité — et un décalage de date
              // > 3 j finirait par créer un doublon. On la réaligne sur l'URL
              // que la source publie aujourd'hui, au moment même où l'on
              // constate qu'elles décrivent la même sortie.
              source_url: cb.sourceUrl,
            })
            .eq('id', near.id)
          if (tErr) console.error(`comeback-ingest title upgrade ${near.id}: ${tErr.message}`)
          else {
            near.title = cb.title
            upgraded++
          }
        }
        skipped++
        continue
      }
      if (decision !== 'insert') {
        // FUSION : l'annonce précise (heure exacte, confirmed) promeut la
        // tentative existante. source_url INTOUCHÉ (clé d'idempotence, leçon
        // 0040) — l'event garde l'URL de sa source d'origine. L'échec (ex.
        // start_at cible déjà pris par l'unique) → skip loggé, pas de crash.
        const nearRow = nears.find((n) => n.id === decision.upgradeId)
        const { error: upErr } = await supabase
          .from('events')
          .update({
            start_at: cb.startAt,
            status: 'confirmed',
            ...(decision.imageUrl === null && cb.imageUrl ? { image_url: cb.imageUrl } : {}),
            ...(nearRow && shouldUpgradeTitle(nearRow.title, cb.title, group.name)
              ? { title: cb.title }
              : {}),
          })
          .eq('id', decision.upgradeId)
        if (upErr) {
          console.error(`comeback-ingest upgrade ${decision.upgradeId}: ${upErr.message}`)
          skipped++
        } else {
          upgraded++
          // Reflet en mémoire : le near devient confirmed à la nouvelle heure
          // (idempotence intra-run — un 2ᵉ candidat identique skippera).
          const near = nears.find((n) => n.id === decision.upgradeId)
          if (near) {
            near.status = 'confirmed'
            near.t = Date.parse(cb.startAt)
          }
        }
        continue
      }
      nears.push({
        id: '',
        t: Date.parse(cb.startAt),
        status: cb.status,
        imageUrl: null,
        title: cb.title,
      })
      nearByGroup.set(group.id, nears)
    }
    existing.add(`${cb.sourceUrl}|${group.id}`)
    // Taxonomie (2026-05-27) : MV = clip (scraper YouTube), Release = sortie
    // datée d'album/single. Une annonce de comeback est une release datée.
    rows.push({
      group_id: group.id,
      source_id: sourceId,
      source_url: cb.sourceUrl,
      type: 'release',
      title: cb.title,
      start_at: cb.startAt,
      status: cb.status,
      image_url: cb.imageUrl,
    })
  }

  // Insert par paquets ; en cas d'échec d'un paquet, repli ligne à ligne pour
  // garder la granularité d'erreur de l'ancienne boucle.
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100)
    const { error } = await supabase.from('events').insert(batch)
    if (!error) {
      inserted += batch.length
      continue
    }
    for (const row of batch) {
      const { error: rowError } = await supabase.from('events').insert(row)
      if (rowError) {
        console.error(`Insert failed for ${row.source_url}:`, rowError.message)
        skipped++
      } else {
        inserted++
      }
    }
  }

  return { matched, inserted, skipped, upgraded }
}
