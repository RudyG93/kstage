import { createClient } from '@/lib/supabase/server'

export async function getUpcomingEvents(limit = 50) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('events')
    .select('id, title, type, start_at, status, groups(slug, name, color_hex)')
    .gte('start_at', new Date().toISOString())
    .order('start_at', { ascending: true })
    .limit(limit)

  if (error) throw error
  return data ?? []
}

export function formatEventDate(iso: string, timezone: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(iso))
}
