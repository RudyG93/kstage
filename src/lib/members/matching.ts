// Dédup de personnes cross-groupe (round 2026-07-18, cas SuA Dreamcatcher/UAU) :
// la création d'un groupe (sub-unit, nouveau projet) recréait une personne déjà
// en base — page dupliquée + mécanisme canonical_id (migration 0012) jamais posé
// automatiquement. Ici : la règle de preuve, PURE et testée. Source unique —
// le check santé `duplicate_person_candidates` réutilise `isSamePerson`.

export function normalizeName(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\s\-_.']/g, '')
}

export type PersonEvidence = {
  id: string
  stage_name: string
  real_name: string | null
  birthday: string | null
  canonical_id: string | null
  group_id: string
}

/**
 * Preuve forte « même personne » — JAMAIS le stage name seul (Sua de MW:MEU ≠
 * Moon Sua de Billlie) :
 *   - real_name normalisé égal, les deux non-nuls, SANS conflit de birthday —
 *     les noms coréens courants collisionnent (vérifié au premier dry-run
 *     prod : NewJeans Minji ↔ Dreamcatcher JiU, toutes deux « Kim Minji » ;
 *     STAYC Isa ↔ fromis_9 Lee Chaeyoung) ; OU
 *   - birthday égal non-nul ET stage_name normalisé égal (les rows créées par
 *     lineup n'ont pas de real_name, mais MusicBrainz pose le birthday).
 */
export function isSamePerson(a: PersonEvidence, b: PersonEvidence): boolean {
  const birthdayConflict = !!a.birthday && !!b.birthday && a.birthday !== b.birthday
  const realMatch =
    !birthdayConflict &&
    !!a.real_name &&
    !!b.real_name &&
    normalizeName(a.real_name) === normalizeName(b.real_name)
  const birthdayMatch =
    !!a.birthday &&
    a.birthday === b.birthday &&
    normalizeName(a.stage_name) === normalizeName(b.stage_name)
  return realMatch || birthdayMatch
}

/**
 * Row canonique d'une personne parmi `candidates` (autres groupes), ou null.
 * Lien seulement si : preuve forte, match UNIQUE, et cible elle-même canonique
 * (canonical_id null — pas de chaîne, invariant migration 0012). Ambigu
 * (2+ matches) → null : le check `duplicate_person_candidates` de
 * /admin/health le remonte pour décision humaine, on ne devine jamais.
 */
export function findCanonicalMatch(
  member: PersonEvidence,
  candidates: readonly PersonEvidence[],
): string | null {
  const matches = candidates.filter(
    (c) =>
      c.id !== member.id &&
      c.group_id !== member.group_id &&
      c.canonical_id == null &&
      isSamePerson(member, c),
  )
  return matches.length === 1 ? matches[0].id : null
}
