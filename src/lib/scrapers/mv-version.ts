import { normalize } from './group-match'

export interface VersionResult {
  kind: 'main' | 'performance' | 'member' | 'other_version'
  memberId: string | null
}

export interface MemberRef {
  id: string
  stage_name: string
}

// Marqueurs Performance-style : insensible à la casse, mot complet.
const PERFORMANCE_RE = /^(performance|dance|choreography|choreo)$/i

// Capture le contenu des parens flat (sans nested) qui contient "ver"/"Ver."
// Ex: "MV (Performance Ver.)" → content = "Performance Ver."
// On itère pour prendre la DERNIÈRE occurrence — utile pour les titres style
// "[STATION] aespa '시대유감 (時代遺憾) (2024 aespa Remake Ver.)' MV" où le ver
// se trouve dans la 2ème paire.
const VER_PAREN_RE = /\(([^()]+)\)/g

/** Extrait le contenu de la paire de parens qui contient "ver." (dernière). */
export function extractVerContent(title: string): string | null {
  let last: string | null = null
  for (const m of title.matchAll(VER_PAREN_RE)) {
    if (/\b[Vv]er\.?\b/.test(m[1])) last = m[1]
  }
  return last
}

/** Strip "Ver." / "ver" et trim. Conserve le reste tel quel.
 * Le lookbehind/ahead [a-zA-Z] empêche de manger "Ver" à l'intérieur de
 * "Version" tout en gérant le cas "Ver." en fin de chaîne (où \b ne match
 * pas après le `.` car suivi de non-word). */
function stripVer(content: string): string {
  return content.replace(/(?<![a-zA-Z])[Vv]er\.?(?![a-zA-Z])/g, '').trim()
}

/** Artiste de tête d'un titre : avant le premier « - » ou la première quote. */
function leadArtist(title: string): string {
  return title.split(/\s[-–—]\s|['‘"]/)[0] ?? title
}

/**
 * Détecte la version d'un MV à partir de son titre + les membres du groupe.
 *
 * - `(... ver.)` présent → Performance > Member (descripteur) > other_version.
 * - sinon → 'main', SAUF si l'artiste de tête est un **membre** (solo posté sur
 *   la chaîne du groupe, ex. « YUQI - 'FREAK' ») et pas le groupe → 'member'.
 *   `groupName` (optionnel) évite de prendre un MV de groupe pour un solo.
 */
export function detectMvVersion(
  title: string,
  members: readonly MemberRef[],
  groupName?: string,
): VersionResult {
  const content = extractVerContent(title)
  if (content) {
    const descriptor = stripVer(content)
    if (!descriptor) return { kind: 'other_version', memberId: null }
    if (PERFORMANCE_RE.test(descriptor)) return { kind: 'performance', memberId: null }
    const desc = normalize(descriptor)
    for (const m of members) {
      if (desc === normalize(m.stage_name)) return { kind: 'member', memberId: m.id }
    }
    return { kind: 'other_version', memberId: null }
  }

  // Pas de « (… ver.) » → clip principal, sauf solo de membre en tête de titre.
  const lead = normalize(leadArtist(title))
  const grp = groupName ? normalize(groupName) : ''
  const isGroupLead = grp.length >= 2 && lead.includes(grp)
  if (!isGroupLead) {
    for (const m of members) {
      const n = normalize(m.stage_name)
      if (n.length >= 3 && lead.includes(n)) return { kind: 'member', memberId: m.id }
    }
  }
  return { kind: 'main', memberId: null }
}
