// Endpoint d'ingestion des events produit CLIENT (Phase 2). Chemin court « /api/e »
// à dessein : « /api/track » matche les patterns des listes de blocage
// (EasyPrivacy) et ferait perdre les events des utilisateurs sous adblock.
//
// Sécurité/vie privée :
// - N'accepte que CLIENT_ALLOWED_EVENTS (un client ne fabrique pas un
//   signup_completed) ; props passées au tamis sanitizeProps ; ni IP ni UA.
// - Connecté : rate-limit via la RPC consume_rate_limit (auth.uid()).
//   Anonyme : la RPC est révoquée pour anon → cap best-effort en service role
//   (≤ 60 rows/h par anon_id). L'enjeu est une pollution de données bornée,
//   pas de la facturation — pas de nouvelle fonction SQL keyed pour ça.
// - Répond TOUJOURS 204 (pas d'oracle sur le vocabulaire ni sur les limites).

import { cookies } from 'next/headers'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { CLIENT_ALLOWED_EVENTS, isProductEvent, sanitizeProps } from '@/lib/analytics/events'
import { trackEvent } from '@/lib/analytics/track'

const ANON_COOKIE = 'kstage_aid'
const ANON_HOURLY_CAP = 60
const AUTHED_HOURLY_CAP = 120

const noContent = () => new Response(null, { status: 204 })

const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

export async function POST(req: Request) {
  // sendBeacon poste en text/plain → parse manuel, silencieux sur tout défaut.
  let body: unknown
  try {
    body = JSON.parse(await req.text())
  } catch {
    return noContent()
  }
  const event = (body as { event?: unknown })?.event
  if (!isProductEvent(event) || !CLIENT_ALLOWED_EVENTS.has(event)) return noContent()
  const props = sanitizeProps(event, (body as { props?: unknown })?.props)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: allowed } = await supabase.rpc('consume_rate_limit', {
      p_action: 'track',
      p_max: AUTHED_HOURLY_CAP,
      p_window_seconds: 3600,
    })
    if (allowed !== true) return noContent()
    await trackEvent(event, { userId: user.id, props })
    return noContent()
  }

  // Anonyme : identifiant first-party opaque (posé ici au premier event).
  const store = await cookies()
  let anonId = store.get(ANON_COOKIE)?.value
  if (!anonId || !isUuid(anonId)) {
    anonId = crypto.randomUUID()
    store.set(ANON_COOKIE, anonId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 365 * 24 * 60 * 60,
      path: '/',
    })
  }

  const service = createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { count } = await service
    .from('product_events')
    .select('id', { count: 'exact', head: true })
    .eq('anon_id', anonId)
    .gte('created_at', new Date(Date.now() - 3600_000).toISOString())
  if ((count ?? 0) >= ANON_HOURLY_CAP) return noContent()

  await trackEvent(event, { anonId, props })
  return noContent()
}
