// Détection « MV officiel » par le TITRE (§4.1). Condition combinée dans le
// scraper : titre officiel (ici) ET uploadé depuis une chaîne officielle du
// groupe (cf. multi-chaînes). Ce module ne gère que le titre (pur, testable).
//
// Officiel si : contient un marqueur MV (whitelist) ET aucun terme de la
// blacklist (teaser, lyric, dance practice, performance, stage, etc.).

// Marqueurs MV — tokens courts en limite de mot, phrases en sous-chaîne.
// « official video » (sans « music ») ajouté pour les solistes au format
// occidental (ex. « JENNIE - like JENNIE (Official Video) ») : detectEventType
// le reconnaissait déjà comme 'mv', mais ce gate le rejetait → MV perdus. Les
// dérivés (« Official Lyric Video », « Performance Video »…) restent filtrés
// par la BLACKLIST, évaluée avant la whitelist.
const WHITELIST_WORD = /\b(mv|m\/v)\b/i
const WHITELIST_PHRASE = /(official music video|music video|official video)/i

// Termes qui disqualifient (dérivés / non-MV). Ordre = priorité de la raison.
const BLACKLIST: { term: string; re: RegExp }[] = [
  ['teaser', /\bteaser\b/i],
  ['trailer', /\btrailer\b/i],
  ['out now', /\bout now\b/i],
  ['lyric', /\blyrics?\b/i],
  ['audio', /\baudio\b/i],
  ['performance', /\bperformance\b/i],
  ['behind', /\bbehind\b/i],
  ['bloopers', /\bbloopers\b/i],
  ['fanchant', /fan ?chant|cheer guide|응원법/i],
  ['making', /\bmaking\b/i],
  // « MV Shoot Sketch » = making-of du tournage du clip (BANGTANTV en poste
  // beaucoup) — un dérivé, pas le MV. Découvert au backfill P0.5.
  ['shoot sketch', /\bshoot sketch\b/i],
  ['dance practice', /\bdance practice\b/i],
  ['dance cover', /\bdance cover\b/i],
  ['choreography', /\bchoreography\b/i],
  ['special video', /\bspecial video\b/i],
  ['special clip', /\bspecial clip\b/i],
  ['reaction', /\breaction\b/i],
  ['live', /\blive\b/i],
  ['concert', /\bconcert\b/i],
  ['stage', /\bstage\b/i],
  ['showcase', /\bshowcase\b/i],
  ['music show', /\b(inkigayo|music bank|music core|show champion|m ?countdown|the show)\b/i],
  ['practice video', /\bpractice video\b/i],
].map(([term, re]) => ({ term: term as string, re: re as RegExp }))

export interface OfficialMvCheck {
  official: boolean
  reason: string // pourquoi rejeté/accepté (pour scrape_log)
}

/** Le titre désigne-t-il un MV officiel ? (whitelist + blacklist). */
export function isOfficialMvTitle(title: string): OfficialMvCheck {
  const hit = BLACKLIST.find((b) => b.re.test(title))
  if (hit) return { official: false, reason: `blacklist:${hit.term}` }
  if (!WHITELIST_WORD.test(title) && !WHITELIST_PHRASE.test(title)) {
    return { official: false, reason: 'no-mv-marker' }
  }
  return { official: true, reason: 'ok' }
}
