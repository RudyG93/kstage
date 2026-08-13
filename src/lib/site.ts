// Domaine canonique unique (déploiement live). Un seul endroit pour éviter la
// dérive — l'email de bienvenue avait divergé sur kstage.app à l'époque où il
// n'était pas branché (liens cassés). Depuis le 2026-08-08, kstage.app est LE
// canonique (A record OVH → Vercel) ; kstage.vercel.app redirige en 308 hors
// /api (next.config) — les crons GitHub et les feeds iCal copiés continuent
// de taper vercel.app en direct.
export const SITE_URL = 'https://kstage.app'

export const CONTACT_EMAIL = 'contact@kstage.app'
