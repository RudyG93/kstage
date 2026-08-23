import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { fetchActiveMembersWithBirthday, generateAnniversaries } from '@/lib/events/anniversaries'
import { kstDayKey } from '@/lib/events/date'
import { isMainOrNonMv } from '@/lib/events/queries'
import { buildCalendarFeed } from '@/lib/ical/feed'
import { SITE_URL } from '@/lib/site'

// Feed iCal perso par token-capability (R3). Public par design : le token
// uuid (122 bits) EST l'authentification — guard de forme + 404 uniforme
// (ne jamais confirmer l'existence d'un token). Pas de rate-limit V1 : les
// polls sont de l'ordre de 1-2×/jour par abonné (Google), token non énumérable.
//
// PAS de cache partagé. Le `s-maxage=3600, stale-while-revalidate=86400`
// d'origine avait deux effets qu'aucune économie ne justifie :
//   - « Reset URL » ne révoquait rien : le CDN continuait de servir le
//     calendrier privé de l'user sur l'ANCIENNE URL pendant 1 h à 24 h ;
//   - une lecture DB en échec se figeait dans le CDN pour la même durée.
// Le volume est nul (1 feed en base au 2026-08-23) : la donnée est privée,
// elle ne se met pas sur une étagère partagée.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const DAY_MS = 24 * 60 * 60 * 1000

const notFound = () => new NextResponse('Not found', { status: 404 })

// Un feed VIDE efface les entrées KStage du calendrier de l'abonné. Sur une
// lecture en échec on refuse de répondre : le client garde sa dernière
// synchronisation réussie et retentera.
const unavailable = () =>
  new NextResponse('Temporarily unavailable', {
    status: 503,
    headers: { 'Cache-Control': 'no-store' },
  })

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  // Suffixe `.ics` accepté : meilleure compat Outlook/clients stricts.
  const token = (await params).token.replace(/\.ics$/i, '').toLowerCase()
  if (!UUID_RE.test(token)) return notFound()

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: feed, error: feedErr } = await supabase
    .from('calendar_feeds')
    .select('user_id')
    .eq('token', token)
    .maybeSingle()
  if (feedErr) return unavailable()
  if (!feed) return notFound()

  // Service role = bypass RLS → filtres user_id EXPLICITES partout.
  const { data: follows, error: followsErr } = await supabase
    .from('user_follows')
    .select('group_id')
    .eq('user_id', feed.user_id)
  // Sans ce garde, une lecture en échec devient « 0 follow » donc un
  // calendrier vide, indiscernable d'un compte qui ne suit personne.
  if (followsErr) return unavailable()
  const groupIds = (follows ?? []).map((f) => f.group_id)

  let events: Parameters<typeof buildCalendarFeed>[0]['events'] = []
  let anniversaries: Parameters<typeof buildCalendarFeed>[0]['anniversaries'] = []

  if (groupIds.length > 0) {
    const since = new Date(Date.now() - 7 * DAY_MS).toISOString()
    const [eventsRes, groupsRes, members] = await Promise.all([
      supabase
        .from('events')
        .select(
          'id, group_id, slug, title, type, start_at, end_at, status, episode_number, source_url, stage_url, created_at, groups!inner(slug, artist_slug, name, color_hex, image_url, image_landscape, banner_url)',
        )
        .in('group_id', groupIds)
        .gte('start_at', since)
        .neq('status', 'cancelled')
        .or(isMainOrNonMv)
        .eq('hidden', false)
        .order('start_at', { ascending: true })
        .limit(500),
      supabase
        .from('groups')
        .select(
          'id, slug, name, color_hex, image_url, image_landscape, banner_url, debut_date, is_solo',
        )
        .in('id', groupIds),
      fetchActiveMembersWithBirthday(supabase, groupIds),
    ])

    if (eventsRes.error || groupsRes.error) return unavailable()
    events = eventsRes.data ?? []
    anniversaries = generateAnniversaries(groupsRes.data ?? [], members, {
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
      // Privé + révocable : ni CDN, ni cache navigateur partagé.
      'Cache-Control': 'private, no-store',
    },
  })
}
