// Helper pur partagé par les crons push : rows `user_notification_settings`
// désactivées → Map<userId, Set<event_type>>. Une seule query par cron
// (.eq('enabled', false) — seules les rows OFF existent en volume minuscule,
// absence de row = type activé par défaut).

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
