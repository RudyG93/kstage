import { SHOW_DESCRIPTORS, type ShowId } from './types'

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/**
 * Calcule l'ISO UTC du prochain créneau hebdo en KST pour un show donné.
 *
 * Stratégie : on regarde le créneau de cette semaine pour ce show en KST. Si ce
 * créneau est encore dans le futur (> now) OU s'il est récent (< 12h dans le
 * passé — la cron de 22:00 KST peut tourner après une diffusion), on l'utilise.
 * Sinon on passe à la semaine suivante.
 *
 * Utile pour les fallbacks qui ne peuvent pas extraire la date depuis la page
 * (cas MnetPlus M Countdown : on tente "Thursday 18:00 KST" du créneau actif).
 */
export function nextWeeklySlotIso(show: ShowId, now: Date): string {
  const desc = SHOW_DESCRIPTORS.find((s) => s.id === show)
  if (!desc) throw new Error(`unknown show: ${show}`)

  // now → KST
  const kstNow = new Date(now.getTime() + KST_OFFSET_MS)
  const kstWeekday = kstNow.getUTCDay()
  const kstYear = kstNow.getUTCFullYear()
  const kstMonth = kstNow.getUTCMonth()
  const kstDay = kstNow.getUTCDate()

  // Créneau de cette semaine en KST.
  const deltaDays = (desc.slot.weekday - kstWeekday + 7) % 7
  const thisWeekSlotKstMs = Date.UTC(
    kstYear,
    kstMonth,
    kstDay + deltaDays,
    desc.slot.hour,
    desc.slot.minute,
  )
  // Reconvertir KST → UTC en soustrayant l'offset.
  const thisWeekSlotUtcMs = thisWeekSlotKstMs - KST_OFFSET_MS

  // Si on est passé du créneau de + 12h, on prend la semaine suivante.
  const tolerance = 12 * 60 * 60 * 1000
  if (thisWeekSlotUtcMs >= now.getTime() - tolerance) {
    return new Date(thisWeekSlotUtcMs).toISOString()
  }
  return new Date(thisWeekSlotUtcMs + 7 * 24 * 60 * 60 * 1000).toISOString()
}

/**
 * Convertit une date locale KST (YYYY, M, D, H, m) en UTC ISO.
 * Utilisé par les sources qui parsent une date explicite depuis le HTML.
 */
export function kstDateTimeToIso(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
): string | null {
  if (month < 1 || month > 12) return null
  if (day < 1 || day > 31) return null
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  const ms = Date.UTC(year, month - 1, day, hour - 9, minute)
  if (Number.isNaN(ms)) return null
  return new Date(ms).toISOString()
}
