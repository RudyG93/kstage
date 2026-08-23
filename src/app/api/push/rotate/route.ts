import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Rotation d'endpoint push, appelée par le SERVICE WORKER.
 *
 * Un navigateur peut invalider un endpoint à tout moment (mise à jour, purge
 * du profil, expiration côté service de push) et émet alors
 * `pushsubscriptionchange`. Sans ce chemin, la nouvelle souscription n'était
 * connue de personne : le navigateur se croyait abonné, la base gardait un
 * endpoint mort, et plus rien n'arrivait. Le service worker ne peut pas
 * appeler une server action — d'où cette route.
 *
 * Auth par le cookie de session (même origine, le SW l'envoie) : on n'écrit
 * jamais pour un autre user que celui qui est connecté sur ce navigateur.
 *
 * GET renvoie la clé publique VAPID, dont le SW a besoin pour re-souscrire
 * quand l'event ne porte pas `oldSubscription.options.applicationServerKey`.
 * Elle est publique par construction (elle voyage déjà dans le bundle client).
 */
export const dynamic = 'force-dynamic'

export function GET() {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!key) return NextResponse.json({ error: 'not configured' }, { status: 503 })
  return NextResponse.json({ key })
}

interface RotateBody {
  oldEndpoint?: unknown
  subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }
}

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.length > 0

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: RotateBody
  try {
    body = (await request.json()) as RotateBody
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const endpoint = body.subscription?.endpoint
  const p256dh = body.subscription?.keys?.p256dh
  const auth = body.subscription?.keys?.auth
  if (!isNonEmptyString(endpoint) || !isNonEmptyString(p256dh) || !isNonEmptyString(auth)) {
    return NextResponse.json({ error: 'invalid subscription' }, { status: 400 })
  }

  // L'ancien endpoint d'abord : si l'insertion échoue, mieux vaut garder une
  // ligne morte qu'aucune ligne — mais l'inverse laisserait un doublon qui
  // ferait échouer un envoi sur deux.
  const { error: insertError } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      user_agent: request.headers.get('user-agent'),
    },
    { onConflict: 'user_id,endpoint' },
  )
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  if (isNonEmptyString(body.oldEndpoint) && body.oldEndpoint !== endpoint) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('endpoint', body.oldEndpoint)
  }

  return NextResponse.json({ ok: true })
}
