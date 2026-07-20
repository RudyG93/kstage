// Helper pur partagé par les crons push : rows `user_notification_settings`
// désactivées → Map<userId, Set<event_type>>. Une seule query par cron
// (.eq('enabled', false) — seules les rows OFF existent en volume minuscule,
// absence de row = type activé par défaut).

/**
 * Heure d'envoi UTC du cron digest — ⚠️ MIROIR de
 * `.github/workflows/crons.yml` (send-digest 10:30) : toute modification là-bas
 * doit être répercutée ici. Sert l'affichage « around HH:MM » (heure locale)
 * du bloc explicatif de /account.
 */
export const DIGEST_SEND_UTC = { hour: 10, minute: 30 } as const

export type DisabledPrefRow = { user_id: string; event_type: string }

export function disabledTypesByUser(rows: readonly DisabledPrefRow[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  for (const r of rows) {
    const set = map.get(r.user_id) ?? new Set<string>()
    set.add(r.event_type)
    map.set(r.user_id, set)
  }
  return map
}
