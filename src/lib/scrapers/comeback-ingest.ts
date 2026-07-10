// Cœur partagé des sources de comebacks « annoncés » (le futur du calendrier) :
// matching nom→groupe + insert idempotent en `type='release'`. Extrait de
// kpopofficial.ts (P0.7) pour qu'une 2ᵉ source (Wikipedia) le réutilise sans
// dupliquer la logique ni risquer une dérive de taxonomie.
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

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
const EDITION_SUFFIX_RE = /\s*\((JP|Japan|CN|China|US|EN|Virtual)\)\s*$/i

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

  // Solo de membre : « NAME (GROUP) » → match du groupe entre parenthèses.
  const paren = artist.match(/^.+?\(([^)]+)\)\s*$/)?.[1]
  if (paren) {
    const parent = matchGroup(paren, groups)
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
export async function ingestComebacks(
  entries: readonly ParsedComeback[],
  sourceId: string,
  groups: readonly GroupRef[],
  supabase: SupabaseClient,
  opts: { crossSourceDedupeDays?: number } = {},
): Promise<{ matched: number; inserted: number; skipped: number }> {
  let matched = 0
  let inserted = 0
  let skipped = 0

  // Matching pur d'abord : une ligne candidate par (entrée, groupe matché).
  const candidates: { cb: ParsedComeback; group: GroupRef }[] = []
  for (const cb of entries) {
    for (const group of matchGroups(cb.artist, groups)) {
      matched++
      candidates.push({ cb, group })
    }
  }
  if (candidates.length === 0) return { matched, inserted, skipped }

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
  const nearByGroup = new Map<string, number[]>()
  if (opts.crossSourceDedupeDays) {
    const ms = opts.crossSourceDedupeDays * 86_400_000
    const times = candidates.map((c) => Date.parse(c.cb.startAt)).filter(Number.isFinite)
    if (times.length > 0) {
      const lo = new Date(Math.min(...times) - ms).toISOString()
      const hi = new Date(Math.max(...times) + ms).toISOString()
      const { data: nearRows } = await supabase
        .from('events')
        .select('group_id, start_at')
        .eq('type', 'release')
        // Pas de filtre source : la fenêtre couvre aussi les entrées de la
        // MÊME source sous une autre URL (placeholder vs album finalisé,
        // SCRAPING.md §3.15).
        .in('group_id', groupIds)
        .gte('start_at', lo)
        .lte('start_at', hi)
      for (const r of nearRows ?? []) {
        const list = nearByGroup.get(r.group_id) ?? []
        list.push(Date.parse(r.start_at))
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
      const t = Date.parse(cb.startAt)
      const nears = nearByGroup.get(group.id) ?? []
      if (nears.some((n) => Math.abs(n - t) <= ms)) {
        skipped++
        continue
      }
      nears.push(t)
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

  return { matched, inserted, skipped }
}
