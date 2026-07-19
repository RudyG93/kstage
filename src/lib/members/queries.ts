import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { createClient as createAnonClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

/**
 * Récupère un membre par son slug composite (`{groupSlug}-{stageName}`).
 * Joint les infos du groupe parent pour le header (lien retour + color_hex
 * pour le placeholder gradient quand `photo_url` est null).
 *
 * `canonical_id` non-null signifie que cette row est un membership historique
 * (ex. ILLIT Youngseo pre_debut). Le caller (route /artists/[slug]) redirige
 * vers la canonique dans ce cas.
 *
 * `cache()` request-scoped : la route /artists/[slug] l'appelle à la fois
 * dans generateMetadata et dans la page — une seule exécution par requête.
 */
export const getMemberBySlug = cache(async (slug: string) => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('members')
    .select(
      'id, slug, stage_name, real_name, birthday, position, photo_url, status, former_reason, canonical_id, links, groups!inner(id, slug, name, color_hex, agency, image_url, is_solo, links, banner_url, banner_yt_url, image_landscape)',
    )
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  return data
})

/**
 * Lookup d'un slug par id — utilisé par la route pour résoudre la redirection
 * vers la canonique sans refaire un select complet.
 */
export async function getMemberSlugById(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('members').select('slug').eq('id', id).maybeSingle()
  if (error) throw error
  return data?.slug ?? null
}

/**
 * Lookup du slug du single member d'un groupe is_solo — utilisé par
 * /groups/[slug] pour rediriger vers /artists/[memberSlug]. Le slug member
 * peut différer du slug du groupe (cas composite `agustd-agust-d` vs
 * `agustd`), d'où la résolution via group_id plutôt que par parité.
 */
export async function getSoloMemberSlugByGroupId(groupId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('members')
    .select('slug')
    .eq('group_id', groupId)
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data?.slug ?? null
}

/**
 * Retourne le parcours (career path) d'un artiste canonique : toutes les rows
 * où `id = canonicalId` (la canonique elle-même) ou `canonical_id = canonicalId`
 * (les memberships historiques). Triées par priorité d'affichage :
 * active → pre_debut → former.
 */
export async function getCareerPath(canonicalId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('members')
    .select('id, slug, status, former_reason, position, groups!inner(slug, name, color_hex)')
    .or(`id.eq.${canonicalId},canonical_id.eq.${canonicalId}`)
  if (error) throw error
  const priority: Record<string, number> = { active: 0, deceased: 0, pre_debut: 1, former: 2 }
  return (data ?? []).sort((a, b) => (priority[a.status] ?? 9) - (priority[b.status] ?? 9))
}

/**
 * Liste les membres d'un groupe pour les sections "Members" / "Former & pre-debut"
 * de `/groups/[slug]`. Tri : actifs en ordre alphabétique d'abord, puis
 * former/pre_debut en fin de liste (gérés par le caller via le `status`).
 */
export async function getMembersForGroup(groupId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('members')
    .select('id, slug, stage_name, photo_url, status, position, birthday')
    .eq('group_id', groupId)
    .order('stage_name', { ascending: true })
  if (error) throw error
  return data ?? []
}

export type MemberSummary = Awaited<ReturnType<typeof getMembersForGroup>>[number]

/**
 * Âge entier depuis une date de naissance ISO — sous-titre des cartes membres
 * quand `position` est vide (le « — » ne disait rien, retour Rudy 2026-07-12).
 * `nowMs` injectable pour les tests (et Date.now() reste hors des composants,
 * lint react purity).
 */
export function ageFromBirthday(
  birthday: string | null,
  nowMs: number = Date.now(),
): number | null {
  if (!birthday) return null
  const ms = Date.parse(birthday)
  if (!Number.isFinite(ms)) return null
  const age = Math.floor((nowMs - ms) / (365.25 * 86_400_000))
  return age >= 0 && age < 100 ? age : null
}

/**
 * Liste tous les membres canoniques cliquables (un par artiste) — pour le picker
 * Bias du profil. `canonical_id is null` = identité actuelle ; `slug not null`
 * pour pouvoir lier vers /artists/[slug].
 */
export const getAllMembers = unstable_cache(
  async () => {
    // Client anon sans cookies (requis par unstable_cache) : members = données
    // publiques quasi statiques (~675 rows) sérialisées dans le payload du profil
    // → cache 1h pour éviter le hit Supabase à chaque visite de profil.
    const supabase = createAnonClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { data, error } = await supabase
      .from('members')
      .select('id, slug, stage_name, photo_url, groups!inner(name)')
      .is('canonical_id', null)
      .not('slug', 'is', null)
      .order('stage_name', { ascending: true })
    if (error) throw error
    return data ?? []
  },
  ['all-members'],
  { revalidate: 3600, tags: ['members'] },
)
