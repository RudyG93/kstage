/**
 * Clé de CHANSON depuis un titre de vidéo k-pop (retour Rudy 2026-08-21).
 *
 * La convention du domaine met le titre de la chanson entre guillemets :
 * « ARTISTE (한글) 'Chanson' Official MV ». On l'extrait pour savoir si une
 * chanson possède DÉJÀ un vrai MV — ce qui décide si un « Performance Video »
 * ou un « Special Video » est le clip principal de cette chanson (KISS OF LIFE
 * « Painting », OURBIRTHDAY « HUNGRY ») ou une simple déclinaison d'un MV
 * existant (« Bad News », « Get Loud »).
 *
 * Les suffixes de déclinaison (Side A/B, Korean ver.…) sont retirés :
 * « HUNGRY (Side A) » et « HUNGRY (Side B) » désignent la même chanson.
 */

// Guillemets rencontrés dans les titres k-pop, déclarés par CODE POINT : écrits
// en clair, l'apostrophe droite fermerait le littéral, et les outils de patch
// les écrasent silencieusement.
const OPENERS = [0x27, 0x22, 0x2018, 0x2019, 0x201c, 0x201d, 0x300c, 0x300e]
const CLOSERS = [0x27, 0x22, 0x2018, 0x2019, 0x201c, 0x201d, 0x300d, 0x300f]
const charClass = (codes: readonly number[]) => codes.map((c) => String.fromCodePoint(c)).join('')

const QUOTED_RE = new RegExp(
  `[${charClass(OPENERS)}]([^${charClass(CLOSERS)}]{1,60})[${charClass(CLOSERS)}]`,
)

const VARIANT_SUFFIX_RE =
  /\(\s*(?:side\s*[ab]|korean|japanese|english|chinese|inst\.?|remix)[^)]*\)/gi

export function songTitleKey(videoTitle: string): string {
  const quoted = QUOTED_RE.exec(videoTitle)
  const raw = quoted ? quoted[1] : videoTitle
  return raw
    .replace(VARIANT_SUFFIX_RE, ' ')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

/**
 * `mv_kind` d'un clip de format secondaire : `main` quand la chanson n'a aucun
 * MV connu (c'est alors LE clip de référence de cette chanson), `performance`
 * sinon.
 */
export function mvKindForSecondary(
  songKey: string,
  knownMainSongKeys: ReadonlySet<string>,
): 'main' | 'performance' {
  return songKey && knownMainSongKeys.has(songKey) ? 'performance' : 'main'
}
