import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// v16 : `middleware.ts` est deprecie au profit de `proxy.ts` (runtime Node —
// requis par cacheComponents, Lot I). La logique session Supabase (getClaims
// local) vit inchangee dans src/lib/supabase/middleware.ts.
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
