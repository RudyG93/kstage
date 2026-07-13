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
  // « MV Commentary » / « M/V 코멘터리 » : l'artiste commente le clip — pas le MV.
  ['commentary', /\bcommentary\b|코멘터리/i],
  // Audit prod 2026-07-03 : familles de dérivés passées entre les mailles.
  // « MV촬영 » / « M/V 촬영 » = tournage du clip (behind coréen).
  ['filming', /촬영/],
  // « M/V BTS » / « MV bts » = behind-the-scenes (ancré à M/V : ne matche PAS
  // le groupe BTS seul).
  ['mv behind', /\bm\/?v\s*bts\b/i],
  // « MV Highlight » = extrait/teaser (ancré à M/V : ne matche pas le groupe
  // Highlight dans « [MV] 하이라이트(HIGHLIGHT) - Chains »).
  ['mv highlight', /\bm\/?v\s*highlight/i],
  // « MV Sketch » = making-of du tournage (Kep1er « Shooting Star MV Sketch #3 »).
  ['mv sketch', /\bm\/?v\s*sketch/i],
  // « Shorts M/V » / « #shorts » = format vertical court, jamais le clip.
  ['shorts', /#?\bshorts\b/i],
  // Markers hangul (déjà dans DERIVATIVE_RE, redoublés ici : ce gate est LA
  // dernière ligne de défense) : 비하인드 = behind, 메이킹 = making, 티저 = teaser.
  ['behind kr', /비하인드/],
  ['making kr', /메이킹/],
  ['teaser kr', /티저/],
  // Déclinaisons non-clip : « Dance Video (MV ver.) », « Lip ver. ».
  ['dance video', /\bdance video\b/i],
  ['lip version', /\blip ver\b/i],
  // « MV Moment Clip #2 » (MCND), « M/V Spoiler » (A.C.E), « MV SOON 7/26 »
  // (posts d'annonce NewJeans) — extraits et annonces, jamais le clip.
  ['moment clip', /\bmoment clip\b/i],
  ['spoiler', /\bspoiler\b/i],
  ['mv soon', /\bm\/?v\s+soon\b/i],
  // « @MV Film » / « M/V Film » : déclinaison (focus film du tournage), pas le MV.
  ['mv film', /\bm\/?v film\b/i],
  // Focus-cam membre : « [#TAEYONG Focus] … » — entre crochets, jamais le MV
  // (n'attrape pas une chanson titrée « Focus » hors crochets).
  ['focus cam', /\[[^\]]*\bfocus\b[^\]]*\]/i],
  ['reaction', /\breaction\b/i],
  ['live', /\blive\b/i],
  ['concert', /\bconcert\b/i],
  ['stage', /\bstage\b/i],
  ['showcase', /\bshowcase\b/i],
  ['music show', /\b(inkigayo|music bank|music core|show champion|m ?countdown|the show)\b/i],
  ['practice video', /\bpractice video\b/i],
  // Contenu / vlog sur la chaîne officielle qui porte « MV » dans le titre
  // (retour Rudy R8, ARTMS). Balayage prod : ces règles ne touchent AUCUN vrai
  // MV (l'emoji brut était trop large — cassait « ROSÉ … F1® » et « TXT
  // 'LO$ER=LO♡ER' » — donc écarté).
  // « … | EN JP CN | … » = liste de sous-titres d'une vidéo de contenu (ARTMS,
  // tripleS talks), jamais un MV officiel.
  ['content subtitles', /\ben\s+jp\s+cn\b/i],
  // « MV Shoot » = tournage du clip en anglais (behind : BANGTAN BOMB, T:TIME,
  // EN-TER key…) — complète le coréen 촬영.
  ['mv shoot', /\bmv shoot\b/i],
  // « [Let's Play …] » = série variété/contenu interactif (MCND) — pas le clip.
  ["let's play", /\blet'?s play\b/i],
  // « … MV Time » = série de contenu (DAILY:DIRECTION « DD MV TIME »).
  ['mv time', /\bmv ?time\b/i],
  // « 메이크업 » = vlog maquillage (Apink-log).
  ['makeup vlog', /메이크업/],
  // « Funniest MV » = compilation humoristique (TRI.BE).
  ['funniest', /\bfunniest\b/i],
  // Posts « anniversaire de vues » : 돌파 = franchi, 달성 = atteint, 공약 =
  // promesse-défi. Marqueurs d'événement, jamais un titre de chanson (« EXO-SC
  // 10억뷰 (1 Billion Views) » — chanson — n'a AUCUN de ces mots → épargné).
  ['view milestone', /돌파|달성|공약/],
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
