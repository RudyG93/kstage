// Dates de naissance des membres, lues sur fandom.
//
// Pourquoi une SECONDE source : l'enrichissement des dates passe par
// MusicBrainz (`ingest.ts`), qui référence mal les groupes récents. TUIDE,
// créé le jour de son début, est reparti avec 7 membres et ZÉRO date. Or la
// date de naissance n'est pas un ornement : c'est elle qui produit les events
// anniversaire — sans elle, le membre n'existe pas dans le calendrier.
//
// Mesuré le 2026-08-24 sur 20 membres tirés des 623 sans date :
// **19 récupérés** (le seul raté est ZENA de MAVE:, un groupe VIRTUEL — il
// n'a pas de date de naissance à trouver). L'API fandom est gratuite et sans
// quota déclaré ; on s'en tient malgré tout à un throttle poli.

const UA = 'KStageBot/0.1 (+https://kstage.app)'
const API = 'https://kpop.fandom.com/api.php'

/** Date `YYYY-MM-DD` extraite d'un wikitext de fiche membre, ou null. */
export function parseBirthdayFromWikitext(wikitext: string): string | null {
  // Forme canonique : {{Birth date and age|1998|3|24}}, parfois précédée d'un
  // `df=yes`/`mf=yes`. C'est celle qu'utilise l'immense majorité des fiches.
  const tpl =
    /\{\{\s*Birth date[^|}]*\|\s*(?:[dm]f\s*=\s*\w+\s*\|\s*)?(\d{4})\s*\|\s*(\d{1,2})\s*\|\s*(\d{1,2})/i.exec(
      wikitext,
    )
  if (tpl) return isoOuNull(+tpl[1], +tpl[2], +tpl[3])

  // Forme littérale : « birth_date = March 24, 1998 ».
  const litt = /\|\s*birth_date\s*=\s*([A-Z][a-z]+)\s+(\d{1,2}),?\s+(\d{4})/.exec(wikitext)
  if (litt) {
    const mois = MOIS.indexOf(litt[1].toLowerCase())
    if (mois >= 0) return isoOuNull(+litt[3], mois + 1, +litt[2])
  }
  return null
}

const MOIS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
]

/** Refuse une date impossible plutôt que d'écrire n'importe quoi en base. */
function isoOuNull(annee: number, mois: number, jour: number): string | null {
  if (annee < 1930 || annee > new Date().getUTCFullYear()) return null
  if (mois < 1 || mois > 12 || jour < 1 || jour > 31) return null
  const d = new Date(Date.UTC(annee, mois - 1, jour))
  // Le 31 février n'existe pas : le Date le décale, on le détecte.
  if (d.getUTCMonth() !== mois - 1 || d.getUTCDate() !== jour) return null
  return `${annee}-${String(mois).padStart(2, '0')}-${String(jour).padStart(2, '0')}`
}

async function fandomJson<T>(params: Record<string, string>): Promise<T | null> {
  const url = `${API}?${new URLSearchParams({ format: 'json', ...params })}`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) return null
  return (await res.json()) as T
}

/**
 * Date de naissance d'un membre, cherchée par « <nom de scène> <groupe> ».
 *
 * Le nom du groupe DANS la requête n'est pas décoratif : les noms de scène
 * k-pop sont massivement homonymes (une dizaine de « Yuna »), et sans lui on
 * ramène la date de quelqu'un d'autre — une erreur invisible, puisqu'une date
 * plausible ne se remarque pas.
 */
export async function fetchMemberBirthday(
  stageName: string,
  groupName: string,
): Promise<string | null> {
  const recherche = await fandomJson<{ query?: { search?: { pageid: number; title: string }[] } }>({
    action: 'query',
    list: 'search',
    srsearch: `${stageName} ${groupName}`,
    srlimit: '3',
  })
  const pages = recherche?.query?.search ?? []
  for (const p of pages) {
    // La page doit NOMMER le membre : « Jia (TUIDE) » ou « Jia ». Une page de
    // groupe ou d'une autre personne arrivée en tête de recherche ne compte pas.
    if (!titreDesigneLeMembre(p.title, stageName)) continue

    // Et elle doit désigner CE membre-ci. Les noms de scène sont massivement
    // homonymes : « Yuna » existe chez ITZY, chez Brave Girls et ailleurs. Un
    // titre désambiguïsé doit nommer LE bon groupe ; un titre nu doit le
    // mentionner dans son wikitext. Sans ce garde on écrit une date plausible
    // mais fausse — et une date fausse produit un anniversaire qui n'existe
    // pas, une erreur que personne ne remarque.
    const desambiguation = /\(([^)]*)\)\s*$/.exec(p.title)?.[1]
    if (desambiguation && !memeGroupe(desambiguation, groupName)) continue

    const parse = await fandomJson<{ parse?: { wikitext?: { '*': string } } }>({
      action: 'parse',
      pageid: String(p.pageid),
      prop: 'wikitext',
      section: '0',
    })
    const w = parse?.parse?.wikitext?.['*']
    if (!w) continue
    if (!desambiguation && !mentionneLeGroupe(w, groupName)) continue

    const b = parseBirthdayFromWikitext(w)
    if (b) return b
  }
  return null
}

const aplatir = (s: string) => s.toLowerCase().replace(/[^a-z0-9ㄱ-힝]/g, '')

/** « ITZY » et « Itzy » sont le même groupe ; « ITZY » et « IZ*ONE » non. */
export function memeGroupe(a: string, b: string): boolean {
  const x = aplatir(a)
  const y = aplatir(b)
  return x.length > 0 && x === y
}

/** Le wikitext d'une page nue cite-t-il bien le groupe ? */
export function mentionneLeGroupe(wikitext: string, groupName: string): boolean {
  const g = aplatir(groupName)
  if (g.length < 2) return false
  // On aplatit la fenêtre d'infobox, pas la page entière : une mention dans
  // une discographie ou une liste de collaborations ne prouve rien.
  return aplatir(wikitext.slice(0, 3000)).includes(g)
}

/** « Jia (TUIDE) » ou « Jia » désignent Jia ; « TUIDE » non. */
export function titreDesigneLeMembre(titre: string, stageName: string): boolean {
  const nu = titre
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim()
    .toLowerCase()
  return nu === stageName.trim().toLowerCase()
}
