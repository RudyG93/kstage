import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { createClient as createAnonClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

const GROUP_FIELDS = 'id, slug, name, fandom_name, debut_date, color_hex, image_url'

/**
 * Liste publique des groupes, mise en cache (§2 perf). Data identique pour tous
 * et qui change rarement → on évite de retaper Supabase à chaque requête (la
 * landing rend ~150 groupes). Client anon SANS cookies : `unstable_cache`
 * interdit la lecture de cookies. Revalidation horaire ; tag `groups` pour une
 * invalidation ciblée si un jour un ajout de groupe doit être visible immédiatement.
 */
export const getGroupsCached = unstable_cache(
  async () => {
    const supabase = createAnonClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { data, error } = await supabase
      .from('groups')
      .select(GROUP_FIELDS)
      .order('name', { ascending: true })
    if (error) throw error
    return data ?? []
  },
  ['groups-all'],
  { revalidate: 3600, tags: ['groups'] },
)

/**
 * Liste tous les groupes (solos + multi-membres). Utilisé par les surfaces qui
 * mélangent encore les deux (calendar filter, sidebar Home, home page). La page
 * `/groups` utilise désormais `getNonSoloGroups` / `getSoloArtists` (tabs).
 */
// `cache()` request-scoped : sidebar Home, calendar filter et home page l'appellent
// dans le même render → une seule requête Supabase par requête HTTP.
export const getGroups = cache(async () => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('groups')
    .select(GROUP_FIELDS)
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
})

/**
 * Liste les **vrais groupes** (multi-membres) — exclut les solistes représentés
 * comme groupes à 1 membre (cf. `seed-soloists.ts`, flag `groups.is_solo`).
 * Sert le tab "Groups" sur `/groups`.
 */
export async function getNonSoloGroups() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('groups')
    .select(GROUP_FIELDS)
    .eq('is_solo', false)
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

/**
 * Liste les solistes avec le slug de leur membre canonique pour pointer la
 * carte directement vers `/artists/[memberSlug]` (évite le détour
 * /groups → re-clic membre).
 *
 * Filtres :
 * - `groups.is_solo = true`
 * - membre embed `position = 'Soloist'` ET `canonical_id IS NULL` (le membre
 *   canonique du solo lui-même, pas un éventuel membership historique).
 */
export async function getSoloArtists() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('groups')
    .select(`${GROUP_FIELDS}, members!inner(slug, position, canonical_id)`)
    .eq('is_solo', true)
    .eq('members.position', 'Soloist')
    .is('members.canonical_id', null)
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []).map((row) => {
    const membersRaw = (row as { members: unknown }).members
    const member = (Array.isArray(membersRaw) ? membersRaw[0] : membersRaw) as {
      slug: string | null
      position: string | null
      canonical_id: string | null
    } | null
    return { ...row, memberSlug: member?.slug ?? null }
  })
}

// `cache()` (request-scoped) : la page groupe appelle getGroupBySlug à la fois
// dans generateMetadata ET dans le composant → une seule requête par render.
export const getGroupBySlug = cache(async (slug: string) => {
  const supabase = await createClient()
  const { data, error } = await supabase.from('groups').select('*').eq('slug', slug).maybeSingle()
  if (error) throw error
  return data
})

export type GroupSummary = Awaited<ReturnType<typeof getNonSoloGroups>>[number]
export type SoloArtistSummary = Awaited<ReturnType<typeof getSoloArtists>>[number]

/**
 * Compteurs de follows par groupe (RPC SECURITY DEFINER publique), mémoïsés
 * par requête — le RPC brut tournait 2× par render sur home et /groups
 * (page + SidebarLeft, Lot A perf 2026-07-18). Renvoie une Map group_id→follows.
 */
export const getGroupFollowCounts = cache(async (): Promise<Map<string, number>> => {
  const supabase = await createClient()
  const { data } = await supabase.rpc('group_follow_counts')
  return new Map((data ?? []).map((r) => [r.group_id, r.follows]))
})
