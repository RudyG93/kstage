// Normalise un titre d'event scrapé pour l'affichage :
//  1. releases kpopofficial : le titre stocké est « <Artiste> <Descripteur
//     d'édition> – <Nom> (<Année>) » — le nom réel est TOUJOURS après le
//     dernier en/em-dash. L'ancienne heuristique `(?:\s+\w+)*` butait sur les
//     descripteurs à tiret interne (« Pre-release Single ») → « release
//     Single - Crow » (retour Rudy 2026-07-12). On prend le segment après le
//     dernier – / — s'il est non vide (« Mark on Me » et « NCT 127 7th Full
//     Album » n'ont pas d'en-dash → intacts).
//  2. autres types : retire le préfixe groupe (ex. "ATEEZ - Golden Hour"),
//  3. supprime l'année trailing entre parenthèses ("(2026)"),
//  4. normalise "Part.5" → "Part 5" (les uploads YouTube collent souvent un point).
// Le nom du groupe est déjà affiché à gauche/au-dessus → inutile de le répéter.
import { matchesGroup } from '@/lib/scrapers/group-match'

export function displayEventTitle(
  title: string,
  groupName?: string | null,
  episodeNumber?: number | null,
  type?: string | null,
): string {
  // MVs (R5, 2026-07-13) : même nommage court partout — le nom de la chanson
  // seul (« Crow »), sans « Groupe 'X' Official MV ». displaySongTitle
  // rappelle displayEventTitle SANS type → pas de récursion.
  if (type === 'mv') {
    const song = displaySongTitle(title, groupName)
    if (song) return song
  }
  let t = title
  const dashSegment =
    type === 'release'
      ? title
          .split(/\s+[–—]\s+/)
          .at(-1)
          ?.trim()
      : undefined
  if (dashSegment && dashSegment !== title && dashSegment.replace(/\s*\(\d{4}\)\s*$/, '').trim()) {
    t = dashSegment
  } else if (groupName) {
    const escaped = groupName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Séparateurs supportés : em-dash (—), en-dash (–), hyphen (-), colon (:).
    // kpopofficial utilise en-dash, YouTube/MV utilisent souvent em-dash ou hyphen.
    t = t.replace(new RegExp(`^${escaped}(?:\\s+\\w+)*\\s*[—–\\-:]\\s*`, 'i'), '')
  }
  t = t.replace(/\s*\(\d{4}\)\s*$/, '')
  t = t.replace(/\b(\w+)\.(\d+)\b/g, '$1 $2')
  t = t.trim()
  // Music shows : suffixe le numéro d'épisode (ex. "Inkigayo #328").
  if (episodeNumber != null) t = `${t} #${episodeNumber}`
  return t
}

// Suffixes "MV"-style strippés en fallback : ce qu'on enlève quand le titre
// n'a pas de quotes pour la chanson.
//
// Le label peut être NU (« … M/V ») ou EMBALLÉ dans une paire de parenthèses
// ou de crochets (« Mantra (Official Video) », convention des labels globaux —
// 95 titres en prod au balayage du 2026-08-23, tous rendus avec leur suffixe).
// Les deux délimiteurs sont appariés dans le motif : un « Song (Official Video »
// sans fermante ne doit pas laisser une parenthèse orpheline derrière lui.
const MV_LABEL =
  // Après « Official », jusqu'à trois mots de qualification : « Official Music
  // Video », « Official Short Film MV », « Official Multiverse Music Video »…
  // Les énumérer un par un revenait à en découvrir un nouveau à chaque scrape.
  '(?:Official\\s+(?:\\w+\\s+){0,3}(?:Video|MV|M\\/V)' +
  '|(?:Music|Performance|Dance\\s+Performance|Lyric)\\s+Video|MV|M\\/V)'
// Le « Official » POSTPOSÉ est une convention Play M (« … Music Video Official »).
const TRAILING_MV_RE = new RegExp(
  `\\s*[—–\\-:]?\\s*(?:\\(${MV_LABEL}\\)|\\[${MV_LABEL}\\]|${MV_LABEL})(?:\\s+Official)?\\s*$`,
  'i',
)

// --- Extraction de la chanson entre quotes -------------------------------
//
// Les titres YouTube k-pop citent la chanson, mais la quote droite `'` sert
// AUSSI d'apostrophe (« It's Me », « Ridin' », « Girls' Night ») et un même
// titre peut porter DEUX segments cités (« &TEAM 'Bewitched' Official MV |
// 'The Witch of Yerasah' Animated Film »). Un `.+` greedy enjambe les deux
// paires ; un `.+?` lazy coupe à l'apostrophe. Aucune quantification ne règle
// les deux — il faut regarder le CONTEXTE de chaque quote.
const QUOTE_CHAR = /['"‘’“”]/
// Ouvre : début de chaîne, espace, ou une ponctuation ouvrante/séparatrice.
// « ㅣ » est la lettre hangul I, employée comme barre verticale décorative
// (OMEGA X) ; « ) » couvre « (오메가엑스)‘Song’ » sans espace.
const BEFORE_OPEN = /[\s([{_\-–—|｜ㅣ)\]}]/
// Ferme : fin de chaîne, espace, ou une ponctuation fermante/séparatrice.
const AFTER_CLOSE = /[\s)\]},._｜|(［]/
// Les guillemets COURBES ne sont jamais des apostrophes : leur orientation
// suffit, le contexte ne les concerne pas (« GENBLUE‘1000次也不夠的想念’ » n'a
// aucun espace avant l'ouvrante). Ils restent éligibles dans l'autre rôle par
// contexte : les titres CLASS:y écrivent « “CLASSY“ », deux ouvrantes.
const ALWAYS_OPEN = /[‘“]/
const ALWAYS_CLOSE = /[’”]/

/**
 * La chanson entre quotes, ou `null` si le titre n'en porte pas.
 *
 * On prend la PREMIÈRE ouvrante, puis la fermante la PLUS LOINTAINE dont le
 * contenu ne referme pas déjà une citation pour en rouvrir une autre. C'est
 * ce seul test qui sépare « WHAT'S GOIN' ON » (apostrophes internes, on garde
 * tout) de « Bewitched' Official MV | 'The Witch of Yerasah » (deux titres
 * distincts, on garde le premier).
 */
function quotedSong(title: string): string | null {
  // Crochets d'angle japonais : jamais des apostrophes, jamais ambigus, et pas
  // toujours précédés d'un espace (« LUN8「MOTLEY CREW」»).
  const cjk = cjkBracket(title)
  if (cjk) return cjk

  const isOpen = (i: number) =>
    ALWAYS_OPEN.test(title[i]) ||
    (QUOTE_CHAR.test(title[i]) && (i === 0 || BEFORE_OPEN.test(title[i - 1])))
  const isClose = (i: number) =>
    ALWAYS_CLOSE.test(title[i]) ||
    (QUOTE_CHAR.test(title[i]) && (i === title.length - 1 || AFTER_CLOSE.test(title[i + 1])))

  let start = -1
  for (let i = 0; i < title.length; i++) {
    if (isOpen(i)) {
      start = i
      break
    }
  }
  if (start === -1) return null

  const closes: number[] = []
  for (let i = start + 1; i < title.length; i++) if (isClose(i)) closes.push(i)

  for (let k = closes.length - 1; k >= 0; k--) {
    const end = closes[k]
    const inner = title.slice(start + 1, end)
    if (!reopensQuote(title, start + 1, end)) return inner
  }
  return null
}

/**
 * Le contenu des premiers crochets d'angle japonais NON enfermés dans des
 * parenthèses. La restriction vise « iKON - #WYD M/V Japanese Short Ver. (from
 * Single「DUMB & DUMBER」) » : entre parenthèses, les crochets nomment le
 * SINGLE dont le clip est extrait, pas la chanson.
 */
function cjkBracket(title: string): string | null {
  let depth = 0
  for (let i = 0; i < title.length; i++) {
    const c = title[i]
    if (c === '(' || c === '（') depth++
    else if (c === ')' || c === '）') depth = Math.max(0, depth - 1)
    else if ((c === '「' || c === '『') && depth === 0) {
      const close = title.indexOf(c === '「' ? '」' : '』', i + 1)
      if (close > i + 1) return title.slice(i + 1, close)
    }
  }
  return null
}

/** Le segment `[from, to)` referme-t-il une citation pour en rouvrir une autre ? */
function reopensQuote(title: string, from: number, to: number): boolean {
  let closed = false
  for (let i = from; i < to; i++) {
    if (!QUOTE_CHAR.test(title[i])) continue
    const asClose =
      ALWAYS_CLOSE.test(title[i]) || i === title.length - 1 || AFTER_CLOSE.test(title[i + 1])
    const asOpen = ALWAYS_OPEN.test(title[i]) || i === 0 || BEFORE_OPEN.test(title[i - 1])
    if (closed && asOpen) return true
    if (asClose) closed = true
  }
  return false
}

/**
 * « 네모네모 (NEMONEMO) » → « NEMONEMO » : quand la CHANSON résiduelle est
 * non-latine (hangul) avec une glose latine entre parenthèses, préférer la
 * glose (retour Rudy 2026-07-17 — romaji/latin partout où le titre le permet ;
 * renversement assumé de l'ancienne politique « hangul + glose »).
 * Sans glose (« 포인트 니모 ») : intact, rien à préférer. Les crédits
 * « (feat. X) » ne sont pas des gloses — conservés tels quels.
 */
function preferLatinGloss(t: string): string {
  const m = t.match(/^[^()]*[가-힣][^()]*\(([^)]*[A-Za-z][^)]*)\)$/)
  if (!m) return t
  const gloss = m[1].trim()
  // « (Guitar by 박주원) » crédite un musicien et « (이사장님은 9등급 OST) »
  // nomme la série : ni l'un ni l'autre n'est une romanisation de la chanson.
  // Le `\S+\s+` évite d'attraper « (By Chance) », qui est bien un titre.
  if (/^(feat|ft|with|prod)[.\s]/i.test(gloss)) return t
  if (/\S+\s+by\s/i.test(gloss) || /\bOST\b/i.test(gloss)) return t
  // « 스릴러 (BTS:Music Video) » : la parenthèse porte un LABEL, pas un titre.
  if (/\b(?:M\/?V|Music Video|Official|Teaser|Trailer)\b/i.test(gloss)) return t
  return gloss
}

/**
 * Extrait uniquement le titre de la chanson depuis un titre scrapé YouTube.
 *
 * Priorité 1 — `quotedSong` : la citation, en tenant compte du contexte de
 * chaque quote (cf. son commentaire). Couvre les curly `‘…’`, les straight
 * `'…'`, les doubles `"…"`/`“…”`, les paires MIXTES (« ‘Friday Night' », vu
 * sur NAVILLERA) et les crochets d'angle japonais `「…」`.
 *
 * Priorité 2 — fallback enrichi : `displayEventTitle` puis strip
 *   (a) groupName + parens optionnelles (hangul/japonais) en début,
 *   (b) le co-artiste d'une collaboration (« JENNIE & Dua Lipa - … »),
 *   (c) suffixes "MV / Official Music Video / (Official Video)" en fin.
 *
 * Utilisé sur les surfaces qui veulent un label court (sidebar Recent
 * comebacks). Pour les surfaces qui gardent plus de contexte (MvsGrid
 * cards, page article), continuer d'utiliser `displayEventTitle`.
 */
export function displaySongTitle(title: string, groupName?: string | null): string {
  const quoted = quotedSong(title)
  if (quoted?.trim()) return preferLatinGloss(quoted.trim())

  let t = displayEventTitle(title, groupName)
  // Tags de tête « [MV] », « [Let's Play MCND] », « (MV) »… (conventions
  // Starship/WM/labels, 168 titres en prod au balayage R6).
  t = t.replace(/^(?:\[[^\]]*\]\s*|\((?:MV|M\/V|Music Video)\)\s*)+/i, '')
  if (groupName) {
    const escaped = groupName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Strip `${groupName} ` ou `${groupName} (...) ` en début, case-insensitive.
    // La paire de parens optionnelle couvre les nom hangul/japonais : "ILLIT
    // (아일릿) Magnetic" → "Magnetic" ; "aespa (에스파) WDA" → "WDA".
    t = t.replace(new RegExp(`^${escaped}\\s*(?:\\([^)]+\\)\\s*)?`, 'i'), '')
    // « 하이라이트(Highlight) - Song » / « (ONF)_Song » : le nom coréen
    // d'abord échappe au strip ci-dessus — si la partie GAUCHE du premier
    // séparateur porte le nom du groupe, la chanson est à droite. Le `_`
    // (convention WM/Starship) se passe d'espaces ; jamais le `-` nu (il
    // couperait « i-dle »).
    const sep = /\s+[-–—_|]\s+|\s*_\s*/.exec(t)
    if (sep && matchesGroup(t.slice(0, sep.index), groupName)) {
      t = t.slice(sep.index + sep[0].length)
    }
    // Collaborations : le retrait du nom laisse le CONNECTEUR et le co-artiste
    // en tête (« JENNIE & Dua Lipa - Handlebars » → « & Dua Lipa - … »).
    // Le co-artiste appartient au crédit, pas au titre de la chanson, et la
    // colonne de gauche porte déjà le groupe : on coupe au premier tiret.
    // Uniquement si ce tiret existe — sinon on effacerait tout le titre.
    // Le tiret doit être ENTOURÉ d'espaces : « & pH-1 - Song » coupe au bon,
    // et « i-dle » ne se fait jamais couper (règle du projet).
    const collab = /^\s*(?:[&,/+]|[xX]\s).*?\s[-–—]\s+/.exec(t)
    if (collab && t.slice(collab[0].length).trim()) t = t.slice(collab[0].length)
  }
  // Séparateur orphelin en tête après retrait du groupe (« – ECHO M/V » sur
  // EPEX(이펙스) – ECHO : le strip du groupe ne consommait pas le tiret, R6).
  const stripped = t
    .replace(TRAILING_MV_RE, '')
    .replace(/^[\s—–\-:·|]+/, '')
    .trim()
  if (stripped) return preferLatinGloss(stripped)
  // Sur-strip : chez DSP la CHANSON est entre crochets (« KARD - [밤밤(Bomb
  // Bomb)] M/V ») — si tout a été mangé, c'est elle qu'il fallait garder.
  const bracket = /\[([^\]]+)\]/.exec(title)
  if (bracket) return preferLatinGloss(bracket[1].trim())
  // Sans crochets, le retrait du label a tout emporté (« PINKVERSE official
  // Cherry blossom MV » n'est QUE du label pour le motif) : un titre imparfait
  // vaut mieux qu'une ligne vide.
  return t.replace(/^[\s—–\-:·|]+/, '').trim()
}
