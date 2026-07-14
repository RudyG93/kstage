import { NextResponse } from 'next/server'
import { searchMvs, searchMembers } from '@/lib/search/queries'
import { extractYouTubeId } from '@/lib/events/youtube-id'

// Segment MVs du dropdown header. Les GROUPES sont désormais filtrés côté client
// (liste servie une fois par /api/search/groups) → « aespa » instantané, sans
// round-trip. Ici withRatings:false : pas de tri par note (6 ratings en base) →
// on économise un round-trip séquentiel par frappe.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json({ members: [], mvs: [] })

  const [members, mvs] = await Promise.all([
    searchMembers(q, 3),
    searchMvs(q, 3, { withRatings: false }),
  ])
  return NextResponse.json(
    {
      members: members.map((m) => ({
        slug: m.slug,
        name: m.stage_name,
        group: m.groups?.name ?? null,
        photo: m.photo_url,
      })),
      mvs: mvs.map((m) => ({
        slug: m.slug,
        title: m.title,
        group: m.groups?.name ?? null,
        videoId: extractYouTubeId(m.source_url),
      })),
    },
    { headers: { 'Cache-Control': 'public, max-age=60' } },
  )
}
