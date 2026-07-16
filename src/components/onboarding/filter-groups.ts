// Recherche client de l'onboarding (audit §12 action 3 : « trouver trois
// artistes puis voir son calendrier ») — fonction pure testable. Sans requête :
// top 30 du classement serveur (l'onboarding ne doit pas être clairsemé) ;
// avec requête : match sous-chaîne insensible casse/accents sur TOUTE la liste
// (un fan de LE SSERAFIM ne doit pas dépendre du top 30).

export type OnboardingGroup = { id: string; name: string; image: string | null }

export const DEFAULT_SHOWN = 30

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

export function filterGroups(groups: readonly OnboardingGroup[], q: string): OnboardingGroup[] {
  const needle = fold(q.trim())
  if (!needle) return groups.slice(0, DEFAULT_SHOWN)
  return groups.filter((g) => fold(g.name).includes(needle))
}
