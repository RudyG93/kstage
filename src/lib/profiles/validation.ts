export const USERNAME_MIN = 3
export const USERNAME_MAX = 20
const USERNAME_RE = /^[A-Za-z0-9_]+$/

// La casse saisie est conservée à l'affichage ; l'unicité est insensible à la
// casse côté DB (colonne `username` en citext) → "Remilio" et "remilio" sont
// considérés comme un doublon par la contrainte unique.
export function normalizeUsername(raw: string): { error: string } | { value: string } {
  const username = (raw ?? '').trim()
  if (!username) return { error: 'Username is required.' }
  if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) {
    return { error: `Username must be ${USERNAME_MIN}–${USERNAME_MAX} characters.` }
  }
  if (!USERNAME_RE.test(username)) {
    return { error: 'Username can only contain letters, numbers and underscores.' }
  }
  return { value: username }
}
