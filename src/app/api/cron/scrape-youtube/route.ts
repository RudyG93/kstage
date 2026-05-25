import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { scrapeGroup } from '@/lib/scrapers/youtube'

// Vercel Cron déclenche en GET et ajoute l'en-tête Authorization: Bearer ${CRON_SECRET}.
export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const apiKey = process.env.YOUTUBE_API_KEY!
  if (!apiKey) return NextResponse.json({ error: 'YOUTUBE_API_KEY not set' }, { status: 500 })

  const { data: sources, error } = await supabase
    .from('sources')
    .select('id, url, group_id')
    .eq('type', 'youtube_api')
    .not('group_id', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const results: Record<string, { inserted: number; skipped: number } | { error: string }> = {}

  for (const source of sources ?? []) {
    try {
      results[source.id] = await scrapeGroup(
        source as { id: string; url: string; group_id: string },
        apiKey,
        supabase,
      )
    } catch (err) {
      results[source.id] = { error: String(err) }
    }
  }

  return NextResponse.json({ ok: true, results })
}
