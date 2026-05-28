import { createClient } from '@/lib/supabase/server'

/**
 * Récupère un membre par son slug composite (`{groupSlug}-{stageName}`).
 * Joint les infos du groupe parent pour le header (lien retour + color_hex
 * pour le placeholder gradient quand `photo_url` est null).
 */
export async function getMemberBySlug(slug: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('members')
    .select(
      'id, slug, stage_name, real_name, birthday, position, photo_url, status, former_reason, groups!inner(id, slug, name, color_hex, agency)',
    )
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  return data
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
    .select('id, slug, stage_name, photo_url, status, position')
    .eq('group_id', groupId)
    .order('stage_name', { ascending: true })
  if (error) throw error
  return data ?? []
}

export type MemberSummary = Awaited<ReturnType<typeof getMembersForGroup>>[number]
