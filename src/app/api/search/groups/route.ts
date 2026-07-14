import { NextResponse } from 'next/server'
import { allGroupsForClient } from '@/lib/search/queries'

// Liste complète des groupes (pré-triée popularité) pour la recherche header
// côté client : appelée UNE fois, filtrée localement → segment groupes instantané
// sans round-trip par frappe. Cachée (unstable_cache 1h) + CDN 1h.
export async function GET() {
  const groups = await allGroupsForClient()
  return NextResponse.json(
    { groups },
    { headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' } },
  )
}
