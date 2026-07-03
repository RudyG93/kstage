import { NextResponse } from 'next/server'
import { searchGroups, searchMvs } from '@/lib/search/queries'
import { extractYouTubeId } from '@/lib/events/youtube-id'

// Recherche instantanée du header (C13) : top groupes + MVs pour le dropdown.
// Données publiques (RLS anon) ; sanitizeIlike appliqué dans les queries.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json({ groups: [], mvs: [] })

  const [groups, mvs] = await Promise.all([searchGroups(q, 5), searchMvs(q, 3)])
  return NextResponse.json(
    {
      groups: groups.map((g) => ({
        slug: g.slug,
        name: g.name,
        image: g.image_url,
        isSolo: g.is_solo,
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
