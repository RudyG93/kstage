import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Cf. server.ts : cookie de session `Secure` en prod uniquement. Doit
      // rester aligné avec le client serveur pour ne pas réécrire le cookie
      // avec des attributs divergents à chaque passage du middleware.
      cookieOptions: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // getClaims (Lot 1bis, 2026-07-18) : le projet signe en ECC P-256 asymétrique
  // → vérification LOCALE du JWT (JWKS caché par instance), plus d'aller-retour
  // Auth par requête comme le faisait getUser(). Le refresh d'un token expiré
  // continue de passer par le réseau (≈ 1×/h/user) et réécrit les cookies via
  // setAll. Les écritures sensibles (server actions, admin) gardent getUser().
  await supabase.auth.getClaims()
  return response
}
