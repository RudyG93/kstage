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
 * `opts.crossSourceDedupeDays` (P0.7) : évite les doublons calendrier quand deux
 * sources annoncent le même comeback. Avant d'insérer, on skippe s'il existe
 * déjà une release pour ce groupe à ±N jours provenant d'une **autre** source
 * (`source_id` différent). La 2ᵉ source ne fait alors que combler les trous de
 * la primaire, sans dupliquer. N'affecte pas les entrées multiples d'une même
 * source (le filtre porte sur `source_id`, pas `source_url`).
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

  for (const cb of entries) {
    for (const group of matchGroups(cb.artist, groups)) {
      matched++

      const { data: existing } = await supabase
        .from('events')
        .select('id')
        .eq('source_url', cb.sourceUrl)
        .eq('group_id', group.id)
        .maybeSingle()

      if (existing) {
        skipped++
        continue
      }

      if (opts.crossSourceDedupeDays) {
        const ms = opts.crossSourceDedupeDays * 86_400_000
        const lo = new Date(Date.parse(cb.startAt) - ms).toISOString()
        const hi = new Date(Date.parse(cb.startAt) + ms).toISOString()
        const { data: near } = await supabase
          .from('events')
          .select('id')
          .eq('group_id', group.id)
          .eq('type', 'release')
          .neq('source_id', sourceId)
          .gte('start_at', lo)
          .lte('start_at', hi)
          .limit(1)
          .maybeSingle()
        if (near) {
          skipped++
          continue
        }
      }

      // Taxonomie (2026-05-27) : MV = clip (scraper YouTube), Release = sortie
      // datée d'album/single. Une annonce de comeback est une release datée.
      const { error } = await supabase.from('events').insert({
        group_id: group.id,
        source_id: sourceId,
        source_url: cb.sourceUrl,
        type: 'release',
        title: cb.title,
        start_at: cb.startAt,
        status: cb.status,
        image_url: cb.imageUrl,
      })

      if (error) {
        console.error(`Insert failed for ${cb.sourceUrl}:`, error.message)
        skipped++
      } else {
        inserted++
      }
    }
  }

  return { matched, inserted, skipped }
}
