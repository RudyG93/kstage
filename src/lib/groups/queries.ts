import { createClient } from '@/lib/supabase/server'

const GROUP_FIELDS = 'id, slug, name, fandom_name, debut_date, color_hex, image_url'

/**
 * Liste tous les groupes (solos + multi-membres). Utilisé par les surfaces qui
 * mélangent encore les deux (calendar filter, sidebar Home, home page). La page
 * `/groups` utilise désormais `getNonSoloGroups` / `getSoloArtists` (tabs).
 */
export async function getGroups() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('groups')
    .select(GROUP_FIELDS)
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

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

export async function getGroupBySlug(slug: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('groups').select('*').eq('slug', slug).maybeSingle()
  if (error) throw error
  return data
}

export type GroupSummary = Awaited<ReturnType<typeof getNonSoloGroups>>[number]
export type SoloArtistSummary = Awaited<ReturnType<typeof getSoloArtists>>[number]
