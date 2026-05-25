import { createClient } from '@/lib/supabase/server'

export async function getGroups() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('groups')
    .select('id, slug, name, agency, fandom_name, debut_date, color_hex, image_url')
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function getGroupBySlug(slug: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('groups').select('*').eq('slug', slug).maybeSingle()
  if (error) throw error
  return data
}

export type GroupSummary = Awaited<ReturnType<typeof getGroups>>[number]
