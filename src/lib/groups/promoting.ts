import { unstable_cache } from 'next/cache'
import { createClient as createAnonClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Groupes qui PROMEUVENT en ce moment : nombre de passages music-show sur les
 * 30 derniers jours.
 *
 * Pourquoi ce signal plutôt qu'un « most followed » (demande Rudy 2026-08-22) :
 * `user_follows` compte 51 lignes pour 3 comptes — un classement y refléterait
 * le goût de trois personnes. Le nombre de passages, lui, est produit par la
 * base elle-même : 255 passages sur 68 groupes au moment de l'écriture, et il
 * grossit tout seul à chaque semaine de diffusion. C'est aussi la seule lecture
 * « qui est actif maintenant » que l'app ne montre nulle part : les pages
 * groupe et artiste affichent les passages D'UN groupe, jamais le palmarès.
 *
 * Données publiques et agrégées → client anon + cache partagé, invalidé par le
 * tag `events` que tous les crons de scraping poussent en fin de run.
 */
export interface PromotingGroup {
  id: string
  slug: string
  name: string
  image_url: string | null
  is_solo: boolean
  stages: number
}

const WINDOW_DAYS = 30

export const getPromotingGroupsCached = unstable_cache(
  async (limit = 6): Promise<PromotingGroup[]> => {
    const supabase = createAnonClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    // Borne alignée sur le JOUR : à la seconde près, l'épisode d'il y a 30
    // jours sort de la fenêtre au fil de l'heure et les compteurs bougent de
    // −1 sous les yeux (constaté entre deux rendus à 15 min d'intervalle).
    const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10)
    const now = new Date().toISOString()

    // ~240 lignes sur la fenêtre — mais paginé quand même : au-delà de 1000,
    // PostgREST tronque SANS erreur et le palmarès mentirait en silence.
    const rows: { groups: unknown }[] = []
    const PAGE = 1000
    for (let from = 0; ; from += PAGE) {
      const { data } = await supabase
        .from('events')
        .select('group_id, groups!inner(id, slug, name, image_url, is_solo)')
        .eq('type', 'music_show')
        .eq('hidden', false)
        .gte('start_at', since)
        .lte('start_at', now)
        .order('start_at', { ascending: true })
        .range(from, from + PAGE - 1)
      if (!data?.length) break
      rows.push(...data)
      if (data.length < PAGE) break
    }

    const byGroup = new Map<string, PromotingGroup>()
    for (const row of rows) {
      const g = row.groups as Omit<PromotingGroup, 'stages'> | null
      if (!g?.slug) continue
      const cur = byGroup.get(g.id)
      if (cur) cur.stages++
      else byGroup.set(g.id, { ...g, stages: 1 })
    }
    return [...byGroup.values()]
      .sort((a, b) => b.stages - a.stages || a.name.localeCompare(b.name))
      .slice(0, limit)
  },
  ['promoting-groups'],
  { revalidate: 3600, tags: ['events'] },
)
