import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTargetableEvents } from '@/lib/suggestions/queries'

/**
 * Lazy fetch des events ciblables par le Suggest-fix. Appelée au mount du
 * formulaire pour éviter de charger 200 events dans le bundle du layout
 * global (toutes les pages payeraient sinon le coût même sans ouvrir la
 * modal).
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const events = await getTargetableEvents()
  return NextResponse.json({ events })
}
