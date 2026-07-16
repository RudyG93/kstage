// Vocabulaire des events produit (Phase 2, audit §10.3) — fermé et typé.
// Le CHECK de la migration 0054 reflète EXACTEMENT cette liste : ajouter un
// event = ce fichier + une migration (garde-fou anti-prolifération).
// Module pur (aucun I/O) : politiques de dédup et sanitisation testables.

export const PRODUCT_EVENTS = [
  'landing_cta_clicked',
  'signup_started',
  'signup_completed',
  'onboarding_started',
  'first_group_followed',
  'three_groups_followed',
  'personal_calendar_ready',
  'push_prompt_shown',
  'push_permission_granted',
  'push_permission_denied',
  'push_permission_unavailable',
  'notification_opened',
  'notification_type_disabled',
  'ical_enabled',
  'search_no_results',
  'feedback_submitted',
  'calendar_opened',
] as const

export type ProductEvent = (typeof PRODUCT_EVENTS)[number]

export const isProductEvent = (v: unknown): v is ProductEvent =>
  typeof v === 'string' && (PRODUCT_EVENTS as readonly string[]).includes(v)

/**
 * Events acceptés depuis le client (POST /api/e) — uniquement ceux qui n'ont
 * pas de point d'ancrage serveur (clic, prompt navigateur, vue effective).
 * Tout le reste s'écrit dans les server actions : un client ne peut pas
 * fabriquer un `signup_completed`.
 */
export const CLIENT_ALLOWED_EVENTS: ReadonlySet<ProductEvent> = new Set([
  'landing_cta_clicked',
  'onboarding_started',
  'personal_calendar_ready',
  'push_prompt_shown',
  'push_permission_granted',
  'push_permission_denied',
  'push_permission_unavailable',
  'notification_opened',
  'calendar_opened',
] satisfies ProductEvent[])

/**
 * Dédup par user (index unique partiel 0054) :
 * - 'once'  : jalon à vie — 1 row par user, point.
 * - 'daily' : 1 row par user et par jour UTC (north-star).
 * - absent  : chaque occurrence compte (recherches vides, feedback…).
 * Les events anonymes (user_id null) ne sont jamais dédupliqués.
 */
export const DEDUPE_POLICY: Partial<Record<ProductEvent, 'daily' | 'once'>> = {
  signup_completed: 'once',
  onboarding_started: 'once',
  first_group_followed: 'once',
  three_groups_followed: 'once',
  personal_calendar_ready: 'once',
  ical_enabled: 'once',
  calendar_opened: 'daily',
}

/**
 * Whitelist de props par event — tout le reste est jeté (jamais de payload
 * libre en DB), valeurs string tronquées. `q` (recherche) est la seule donnée
 * saisie par l'utilisateur qu'on garde, bornée à 80.
 */
const PROPS_WHITELIST: Partial<Record<ProductEvent, readonly string[]>> = {
  landing_cta_clicked: ['cta'],
  notification_opened: ['path'],
  notification_type_disabled: ['type'],
  search_no_results: ['q', 'seg'],
  feedback_submitted: ['kind'],
  calendar_opened: ['surface', 'src'],
  personal_calendar_ready: ['surface'],
  push_prompt_shown: ['surface'],
  push_permission_granted: ['surface'],
  push_permission_denied: ['surface'],
  push_permission_unavailable: ['surface'],
}

const MAX_PROP_LENGTH = 120

export function sanitizeProps(event: ProductEvent, raw: unknown): Record<string, string> {
  const allowed = PROPS_WHITELIST[event]
  if (!allowed || typeof raw !== 'object' || raw === null) return {}
  const out: Record<string, string> = {}
  for (const key of allowed) {
    const value = (raw as Record<string, unknown>)[key]
    if (typeof value !== 'string' || value.length === 0) continue
    const max = key === 'q' ? 80 : MAX_PROP_LENGTH
    out[key] = value.slice(0, max)
  }
  return out
}
