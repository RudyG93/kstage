import { NextResponse } from 'next/server'
import { getCalendarMonthEvents } from '@/lib/events/calendar-month'
import { isValidTimeZone } from '@/lib/profiles/timezone'

// Payload d'un mois calendrier pour la navigation client (round 2026-07-18 —
// demande explicite : plus de changement de mois par navigation URL). Données
// 100 % publiques (events + anniversaires + slots) → cacheable CDN.
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get('month') ?? ''
  const m = /^(\d{4})-(\d{2})$/.exec(raw)
  const year = m ? Number(m[1]) : NaN
  const month = m ? Number(m[2]) : NaN
  if (!m || month < 1 || month > 12 || year < 2000 || year > 2100) {
    return NextResponse.json({ error: 'month=YYYY-MM requis' }, { status: 400 })
  }
  // La fenêtre du mois dépend du fuseau qui dessine la grille : il fait donc
  // partie de la clé de cache CDN, sinon un viewer sert la version d'un autre.
  const tz = new URL(req.url).searchParams.get('tz') ?? ''
  const timeZone = isValidTimeZone(tz) ? tz : 'Asia/Seoul'
  const events = await getCalendarMonthEvents(year, month, timeZone)
  return NextResponse.json(
    { events },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
  )
}
