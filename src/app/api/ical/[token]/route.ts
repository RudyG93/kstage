import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { generateAnniversaries } from '@/lib/events/anniversaries'
import { kstDayKey } from '@/lib/events/date'
import { isMainOrNonMv } from '@/lib/events/queries'
import { buildCalendarFeed } from '@/lib/ical/feed'

// Feed iCal perso par token-capability (R3). Public par design : le token
// uuid (122 bits) EST l'authentification — guard de forme + 404 uniforme
// (ne jamais confirmer l'existence d'un token). Pas de rate-limit V1 : le
// s-maxage CDN absorbe les polls (Google ~1-2×/jour), token non énumérable.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const DAY_MS = 24 * 60 * 60 * 1000
const SITE_URL = 'https://kstage.vercel.app'

const notFound = () => new NextResponse('Not found', { status: 404 })

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  // Suffixe `.ics` accepté : meilleure compat Outlook/clients stricts.
  const token = (await params).token.replace(/\.ics$/i, '').toLowerCase()
  if (!UUID_RE.test(token)) return notFound()

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: feed } = await supabase
    .from('calendar_feeds')
    .select('user_id')
    .eq('token', token)
    .maybeSingle()
  if (!feed) return notFound()

  // Service role = bypass RLS → filtres user_id EXPLICITES partout.
  const { data: follows } = await supabase
    .from('user_follows')
    .select('group_id')
    .eq('user_id', feed.user_id)
  const groupIds = (follows ?? []).map((f) => f.group_id)

  let events: Parameters<typeof buildCalendarFeed>[0]['events'] = []
  let anniversaries: Parameters<typeof buildCalendarFeed>[0]['anniversaries'] = []

  if (groupIds.length > 0) {
    const since = new Date(Date.now() - 7 * DAY_MS).toISOString()
    const [eventsRes, groupsRes, membersRes] = await Promise.all([
      supabase
        .from('events')
        .select(
          'id, group_id, slug, title, type, start_at, end_at, status, episode_number, source_url, stage_url, created_at, groups!inner(slug, name, color_hex, image_url, image_landscape, banner_url)',
        )
        .in('group_id', groupIds)
        .gte('start_at', since)
        .neq('status', 'cancelled')
        .or(isMainOrNonMv)
        .order('start_at', { ascending: true })
        .limit(500),
      supabase
        .from('groups')
        .select('id, slug, name, color_hex, image_url, image_landscape, banner_url, debut_date')
        .in('id', groupIds),
      supabase.from('members').select('group_id, stage_name, birthday').in('group_id', groupIds),
    ])

    events = eventsRes.data ?? []
    anniversaries = generateAnniversaries(groupsRes.data ?? [], membersRes.data ?? [], {
      todayKey: kstDayKey(new Date().toISOString()),
      days: 90,
    })
  }

  // Follows vides → VCALENDAR vide VALIDE (pas 404 : le feed existe).
  const ics = buildCalendarFeed({ events, anniversaries, siteUrl: SITE_URL })

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="kstage.ics"',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
