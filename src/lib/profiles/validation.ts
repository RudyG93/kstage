export const USERNAME_MIN = 3
export const USERNAME_MAX = 20
const USERNAME_RE = /^[a-z0-9_]+$/

/** Valide + normalise un username user non fiable (stocké en minuscules). */
export function normalizeUsername(raw: string): { error: string } | { value: string } {
  const username = (raw ?? '').trim().toLowerCase()
  if (!username) return { error: 'Username is required.' }
  if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) {
    return { error: `Username must be ${USERNAME_MIN}–${USERNAME_MAX} characters.` }
  }
  if (!USERNAME_RE.test(username)) {
    return { error: 'Username can only contain lowercase letters, numbers and underscores.' }
  }
  return { value: username }
}
