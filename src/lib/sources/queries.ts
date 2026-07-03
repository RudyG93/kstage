import { createClient } from '@/lib/supabase/server'

export interface SourcesStatus {
  count: number
  lastScrapedAt: string | null
}

/**
 * Statut des sources de scraping pour le footer data-forward de la home
 * (« 12 SOURCES SCRAPED · UPDATED 2 MIN AGO »). Renvoie null si la table est
 * vide ou inaccessible — le footer se masque alors, le design tient sans.
 */
export async function getSourcesStatus(): Promise<SourcesStatus | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('sources').select('last_scraped_at')
  if (error || !data || data.length === 0) return null
  const timestamps = data
    .map((s) => s.last_scraped_at)
    .filter((t): t is string => t !== null)
    .sort()
  return {
    count: data.length,
    lastScrapedAt: timestamps.length > 0 ? timestamps[timestamps.length - 1] : null,
  }
}
