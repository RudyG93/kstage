import type { createClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database'

type SupabaseClient = ReturnType<typeof createClient<Database>>

export type ScrapeStatus = 'ok' | 'partial' | 'error'

/**
 * Écrit une ligne d'audit par run de cron dans `scrape_log` (deny-all RLS :
 * seuls les crons en service_role écrivent — cf. migration 0024).
 *
 * Sémantique des statuts (cf. SCRAPING.md §6) :
 * - `ok`      : run nominal.
 * - `partial` : run dégradé mais exploitable (une partie des sources en échec,
 *               ou pages fetchées mais 0 entrée parsée = signature d'un
 *               changement de markup).
 * - `error`   : run inexploitable (0 source/page OK) — la route renvoie 500
 *               pour que le dashboard Vercel Crons montre l'échec.
 *
 * Ne throw jamais : le logging ne doit pas faire échouer un run par ailleurs
 * sain.
 */
export async function logScrapeRun(
  supabase: SupabaseClient,
  entry: {
    source: string
    status: ScrapeStatus
    startedAt: string
    errorMsg?: string | null
    details?: Record<string, unknown>
  },
): Promise<void> {
  const { error } = await supabase.from('scrape_log').insert({
    source: entry.source,
    status: entry.status,
    error_msg: entry.errorMsg ?? null,
    started_at: entry.startedAt,
    ended_at: new Date().toISOString(),
    // Les shapes appelantes (counts par source, erreurs) sont toutes
    // JSON-sérialisables ; le cast évite la friction structurelle avec Json.
    details: (entry.details ?? null) as Json,
  })
  if (error) console.error(`[scrape-log] insert failed: ${error.message}`)
}
