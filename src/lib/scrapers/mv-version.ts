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

/**
 * Détecte la version d'un MV à partir de son titre + les membres connus du
 * groupe. Ordre des règles : Performance > Member > other_version.
 *
 * - 'main' : pas de paire `(... ver.)` → c'est le clip principal.
 * - 'performance' : descripteur ∈ {performance, dance, choreography, choreo}.
 * - 'member' : descripteur égal au stage_name d'un membre du groupe
 *   (égalité stricte après normalize Unicode). Renseigne memberId.
 * - 'other_version' : tout le reste (English, Remake, æ-aespa, etc.).
 */
export function detectMvVersion(title: string, members: readonly MemberRef[]): VersionResult {
  const content = extractVerContent(title)
  if (!content) return { kind: 'main', memberId: null }

  const descriptor = stripVer(content)
  if (!descriptor) return { kind: 'other_version', memberId: null }

  if (PERFORMANCE_RE.test(descriptor)) return { kind: 'performance', memberId: null }

  const desc = normalize(descriptor)
  for (const m of members) {
    if (desc === normalize(m.stage_name)) {
      return { kind: 'member', memberId: m.id }
    }
  }

  return { kind: 'other_version', memberId: null }
}
