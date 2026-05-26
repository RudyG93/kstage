import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { scrapeComebacks } from '@/lib/scrapers/kpopofficial'

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

  const { data: source, error: sourceError } = await supabase
    .from('sources')
    .select('id')
    .eq('type', 'kpopofficial')
    .maybeSingle()

  if (sourceError) return NextResponse.json({ error: sourceError.message }, { status: 500 })
  if (!source)
    return NextResponse.json({ error: 'kpopofficial source not seeded' }, { status: 500 })

  const { data: groups, error: groupsError } = await supabase
    .from('groups')
    .select('id, slug, name')

  if (groupsError) return NextResponse.json({ error: groupsError.message }, { status: 500 })

  try {
    const result = await scrapeComebacks(source, groups ?? [], supabase)
    return NextResponse.json({ ok: true, result })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
