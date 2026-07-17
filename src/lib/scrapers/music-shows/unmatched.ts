// Persistance des artistes de lineup non matchés (retour Rudy 2026-07-17) :
// filtre anti-bruit PUR + upsert best-effort vers lineup_unmatched. Le bruit
// réel observé dans scrape_log : « ~ » (séparateur carrd), « ** GIRLSET »
// (préfixe astérisques inkigayo), « MC Special Stage (MINJAE & CHUEI LYU »
// (stage spécial tronqué), noms mutilés à parenthèse non fermée.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { normalize } from '@/lib/scrapers/group-match'

/**
 * Nettoie un nom brut de lineup et le rejette s'il ressemble à du bruit de
 * parsing plutôt qu'à un artiste. Retourne null pour « à ignorer ».
 */
export function cleanUnmatchedName(raw: string): { nameNorm: string; display: string } | null {
  // Préfixes décoratifs (« ** GIRLSET ») et espaces.
  const display = raw.replace(/^[*\s]+/, '').trim()
  if (display.length < 2) return null // « ~ », vides
  // Stages spéciaux / segments MC — pas des artistes à créer.
  if (/^mc\b/i.test(display) || /special stage/i.test(display)) return null
  // Parenthèse ouverte jamais fermée = nom tronqué par le parsing.
  const opens = (display.match(/\(/g) ?? []).length
  const closes = (display.match(/\)/g) ?? []).length
  if (opens !== closes) return null
  const nameNorm = normalize(display)
  if (!nameNorm || nameNorm.length < 2) return null
  return { nameNorm, display }
}

export type UnmatchedCollector = Map<string, { display: string; shows: Set<string> }>

/** Ajoute un nom brut au collecteur du run (déduplique par nom normalisé). */
export function collectUnmatched(collector: UnmatchedCollector, raw: string, show: string): void {
  const cleaned = cleanUnmatchedName(raw)
  if (!cleaned) return
  const entry = collector.get(cleaned.nameNorm)
  if (entry) {
    entry.shows.add(show)
  } else {
    collector.set(cleaned.nameNorm, { display: cleaned.display, shows: new Set([show]) })
  }
}

/**
 * Upsert du collecteur en fin de run : +1 occurrence par nom vu ce run, union
 * des shows, last_seen rafraîchi. Best-effort — une erreur ici ne doit jamais
 * faire échouer le scrape (le run la remonte en warning via le retour).
 */
export async function persistUnmatched(
  supabase: SupabaseClient<Database>,
  collector: UnmatchedCollector,
): Promise<{ upserted: number; error?: string }> {
  if (collector.size === 0) return { upserted: 0 }
  try {
    const norms = [...collector.keys()]
    const { data: existing, error: readErr } = await supabase
      .from('lineup_unmatched')
      .select('name_norm, shows, occurrences')
      .in('name_norm', norms)
    if (readErr) return { upserted: 0, error: readErr.message }
    const known = new Map((existing ?? []).map((r) => [r.name_norm, r]))
    const nowIso = new Date().toISOString()
    let upserted = 0
    for (const [nameNorm, { display, shows }] of collector) {
      const prev = known.get(nameNorm)
      const { error } = prev
        ? await supabase
            .from('lineup_unmatched')
            .update({
              occurrences: prev.occurrences + 1,
              shows: [...new Set([...(prev.shows ?? []), ...shows])],
              last_seen: nowIso,
            })
            .eq('name_norm', nameNorm)
        : await supabase.from('lineup_unmatched').insert({
            name_norm: nameNorm,
            display_name: display,
            shows: [...shows],
          })
      if (error) return { upserted, error: error.message }
      upserted++
    }
    return { upserted }
  } catch (e) {
    return { upserted: 0, error: String(e) }
  }
}
