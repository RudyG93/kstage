'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Anonyme : le serveur ne connaît pas le fuseau du navigateur. Ce composant le
 * détecte au montage et le pose en cookie `tz` (lu par getViewerTimeZone côté
 * serveur), puis un SEUL router.refresh() pour que le SSR reflète la vraie tz.
 * Garde anti-boucle : ne pose/refresh que si la valeur change (après le 1er
 * passage, le cookie matche → plus de refresh). Les comptes connectés utilisent
 * profiles.timezone ; ce cookie reste inoffensif pour eux.
 */
export function TimezoneCookie() {
  const router = useRouter()
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (!tz) return
    const current = document.cookie
      .split('; ')
      .find((c) => c.startsWith('tz='))
      ?.slice(3)
    if (decodeURIComponent(current ?? '') === tz) return
    document.cookie = `tz=${encodeURIComponent(tz)}; Max-Age=31536000; Path=/; SameSite=Lax`
    router.refresh()
  }, [router])
  return null
}
