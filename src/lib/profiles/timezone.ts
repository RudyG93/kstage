import { cache } from 'react'
import { cookies } from 'next/headers'
import { getViewer } from '@/lib/supabase/viewer'

// KST = référence historique du fandom + fallback quand on ne connaît pas encore
// le fuseau du viewer (1er rendu anonyme avant que le cookie soit posé).
export const DEFAULT_TIME_ZONE = 'Asia/Seoul'

/** Valide un identifiant IANA (rejette une valeur cookie/DB corrompue). */
export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/**
 * Fuseau du viewer, résolu une fois par requête (mémoïsé) :
 * profil `profiles.timezone` (connecté) → cookie navigateur `tz` (anonyme, posé
 * par TimezoneCookie) → défaut KST. Sert le D-day, le regroupement par jour et le
 * calendrier côté serveur ; l'heure PRIMAIRE reste gérée par LocalTime (fuseau
 * navigateur, post-hydratation).
 */
export const getViewerTimeZone = cache(async (): Promise<string> => {
  const { profile } = await getViewer()
  const profileTz = profile?.timezone
  if (isValidTimeZone(profileTz)) return profileTz
  const cookieTz = (await cookies()).get('tz')?.value
  return isValidTimeZone(cookieTz) ? cookieTz : DEFAULT_TIME_ZONE
})
