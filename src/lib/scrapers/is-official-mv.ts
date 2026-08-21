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
  // « MV Shooting » autant que « MV Shoot » : le suffixe -ing cassait la
  // frontière de mot — 20 rows en prod, dont les 9 BANGTAN BOMB « 'FIRE' MV
  // Shooting » et le « [Beh!nd Un!corn] … MV shooting » signalé par Rudy.
  // ANCRÉ À MV : « Kep1er 'Shooting Star' M/V » et « DAY6 "Shoot Me" M/V »
  // sont de vrais clips dont la CHANSON porte le mot.
  ['mv shoot', /\bm\/?v\s*shoot(ing)?\b/i],
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
  // ─── Audit prod 2026-08-21 ────────────────────────────────────────────────
  // Retour Rudy sur « [Beh!nd Un!corn] … MV shooting ». Les 3 047 MV de la base
  // ont été repassés au filtre : ces familles de contenu NON-clip passaient
  // toutes. Chaque terme est ANCRÉ à M/V quand le mot seul pourrait être un
  // titre de chanson.
  // « M/V Monitoring Clip #1..#9 » (TWICE) : le groupe regarde son propre clip.
  ['monitoring', /\bmonitoring\b/i],
  // « 'Bubble Gum' MV Review » (NewJeans ×4), « … MV 리뷰 » : réaction.
  ['mv review', /\bm\/?v\s*(review|리뷰)\b/i],
  ['interview', /\binterview\b|인터뷰/i],
  ['synopsis', /\bsynopsis\b/i],
  // « MV 해석 » / « MV theory » : décryptage du clip.
  ['mv analysis', /\bm\/?v\s*(해석|theory)\b/i],
  // « What Goes On at the MV Set » : coulisses de plateau.
  ['mv set', /\bm\/?v\s*set\b/i],
  // « MV EXTRA CUT » (IVE), « MV BONUS CUT » (ZEROBASEONE) : rushes.
  ['bonus cut', /\b(bonus|extra)\s+cut\b/i],
  // « ['Hey Mama!' MV EVENT] » (EXO), « M/V QUIZ EVENT » (ASTRO) : animation.
  ['mv event', /\bm\/?v\s*(event|quiz)\b/i],
  // « MV 콘테스트 » : concours de montage proposé aux fans (aespa × Premiere Pro).
  ['contest', /\bcontest\b|콘테스트/i],
  // « MV 미니 다큐멘터리 » (ILLIT).
  ['documentary', /\bdocumentar(y|ies)\b|다큐멘터리/i],
  // « 첫 MV 시사 » (Dreamcatcher), « 상영회 » : projection / avant-première.
  ['screening', /시사|상영회/],
  // « MV MAKINGFILM » collé en un mot : \bmaking\b ne l'attrape pas.
  ['making film', /\bmaking ?film\b/i],
  // « MV release Countdown » (&TEAM) : compte à rebours, pas la sortie.
  ['release countdown', /\brelease\s*countdown\b/i],
  // PAS de règle « DIY » : « VERIVERY - '소중력' DIY M/V (Produced by VERIVERY) »
  // désigne un vrai clip auto-produit par le groupe (6 rows), au même titre
  // qu'une version self-cam. Seules les projections « DIY M/V 상영회 » tombent,
  // via `screening`. Un clip réel écarté coûte plus cher qu'un bonus gardé.
  // « M/V COPY » (TWICE), « (MV Demo) » (Jackson Wang) : brouillons de travail.
  ['mv copy', /\bm\/?v\s*copy\b/i],
  ['mv demo', /\bm\/?v\s*demo\b/i],
].map(([term, re]) => ({ term: term as string, re: re as RegExp }))

/**
 * Formats de clip OFFICIELS mais secondaires (retour Rudy 2026-08-21).
 *
 * Une part des sorties k-pop n'a PAS de « MV » : leur seul visuel officiel est
 * un « Performance Video » ou un « Special Video » — KISS OF LIFE « Painting »
 * et « Don't mind me », OURBIRTHDAY « HUNGRY (Side A/B) ». Les blacklister
 * faisait disparaître ces chansons de l'app. À l'inverse, quand un vrai MV
 * existe (« Bad News », « Get Loud »), le Performance Video n'est qu'une
 * déclinaison.
 *
 * Ils passent donc le gate, marqués `secondary` : l'appelant les classe
 * `mv_kind='performance'` s'il connaît déjà un MV principal pour la chanson,
 * sinon `main` (c'est le clip de référence). Cf. `mvKindForSecondary`.
 */
const SECONDARY_VISUAL = /\b(performance|special)\s+(video|clip)\b/i

export interface OfficialMvCheck {
  official: boolean
  reason: string // pourquoi rejeté/accepté (pour scrape_log)
  /** Clip officiel d'un format secondaire (Performance/Special Video) : à
      classer `main` seulement si la chanson n'a pas de vrai MV. */
  secondary?: boolean
}

/**
 * Termes qui disqualifient MEME un format secondaire (« Performance Video
 * Behind », « Special Video Teaser », « … Shoot Sketch »). C'est la blacklist
 * privee des motifs qui DEFINISSENT ces formats.
 */
const SECONDARY_EXEMPT = new Set(['performance', 'special video', 'special clip'])
const DERIVATIVE_BLOCKERS = BLACKLIST.filter((b) => !SECONDARY_EXEMPT.has(b.term))

/**
 * Rend lisibles les lettres remplacées par de la ponctuation ou des chiffres.
 *
 * La k-pop stylise énormément les noms de séries et de groupes, et la
 * blacklist raisonne en MOTS : « [Beh!nd Un!corn] … MV shooting » (Hi-Fi
 * Un!corn) n'a jamais déclenché la règle `behind` parce que le « i » est un
 * « ! ». Le titre a donc été publié comme un vrai clip (signalé par Rudy le
 * 2026-08-21).
 *
 * Substitutions leet classiques uniquement, et le résultat sert EXCLUSIVEMENT
 * à re-tester la blacklist — jamais à valider un titre. Au pire on rejette un
 * peu plus ; on ne peut pas accepter un dérivé de plus.
 */
export function destylize(title: string): string {
  return title
    .replace(/!/g, 'i')
    .replace(/1/g, 'i')
    .replace(/0/g, 'o')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/\$/g, 's')
    .replace(/@/g, 'a')
}

/** Le titre designe-t-il un MV officiel ? (whitelist + blacklist). */
export function isOfficialMvTitle(title: string): OfficialMvCheck {
  // Le titre dé-stylisé passe les MÊMES gates : un dérivé ne doit pas s'en
  // tirer parce que son nom de série écrit « Beh!nd » au lieu de « Behind ».
  const plain = destylize(title)
  // 1. Derives : ils invalident tout, y compris un format secondaire.
  const derivative = DERIVATIVE_BLOCKERS.find((b) => b.re.test(title) || b.re.test(plain))
  if (derivative) return { official: false, reason: `blacklist:${derivative.term}` }
  // 2. Format secondaire officiel (Performance/Special Video) : accepte, mais
  //    marque — son rang depend de l'existence d'un vrai MV pour la chanson.
  if (SECONDARY_VISUAL.test(title))
    return { official: true, reason: 'secondary-visual', secondary: true }
  // 3. Blacklist complete puis whitelist, comme avant.
  const hit = BLACKLIST.find((b) => b.re.test(title) || b.re.test(plain))
  if (hit) return { official: false, reason: `blacklist:${hit.term}` }
  if (!WHITELIST_WORD.test(title) && !WHITELIST_PHRASE.test(title)) {
    return { official: false, reason: 'no-mv-marker' }
  }
  return { official: true, reason: 'ok' }
}
