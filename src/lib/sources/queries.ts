import { createClient } from '@/lib/supabase/server'

export interface SourcesStatus {
  count: number
}

/**
 * Statut des sources de scraping pour le footer data-forward de la home
 * (« 12 SOURCES SCRAPED »). Renvoie null si la table est vide ou inaccessible —
 * le footer se masque alors, le design tient sans. (Le « last updated » global
 * a été retiré de l'affichage : une seule source fraîche masquait les périmées,
 * audit §7.6 — la fraîcheur par famille vit dans la carte Source health /admin.)
 */
export async function getSourcesStatus(): Promise<SourcesStatus | null> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('sources')
    .select('id', { count: 'exact', head: true })
  if (error || !count) return null
  return { count }
}

/**
 * Popularité par groupe = max des subscriber_count de ses chaînes YouTube
 * (critère validé P0.5 — spotify_followers est inalimentable, vérifié 0/112 en
 * prod). Sert au tri « groupes les plus connus » (mur landing, recherche).
 */
export async function getGroupSubscriberCounts(): Promise<Map<string, number>> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('sources')
    .select('group_id, subscriber_count')
    .not('subscriber_count', 'is', null)
    .not('group_id', 'is', null)
  const out = new Map<string, number>()
  for (const row of data ?? []) {
    if (!row.group_id || row.subscriber_count == null) continue
    out.set(row.group_id, Math.max(out.get(row.group_id) ?? 0, row.subscriber_count))
  }
  return out
}
