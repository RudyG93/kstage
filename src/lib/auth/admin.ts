// Modèle admin minimal (étape 8) : allowlist d'emails via env, server-only.
// Pas de table de rôles au MVP — voir §10 PROJECT.md pour l'évolution V2.

/** Parse la CSV ADMIN_EMAILS en liste normalisée (lowercase, trim, sans vides). */
export function parseAdminEmails(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

/** True si l'email fait partie de l'allowlist ADMIN_EMAILS. */
export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  return parseAdminEmails(process.env.ADMIN_EMAILS).includes(email.toLowerCase())
}
