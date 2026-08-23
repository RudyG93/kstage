// Vainqueurs des music shows, extraits des pages « List of {show} Chart
// winners (YYYY) » — les MÊMES pages que `episode-numbers.ts` lit déjà pour la
// numérotation. Zéro source nouvelle, zéro appel réseau en plus : la ligne qui
// porte (épisode, date) porte aussi l'artiste, le titre et le rang de victoire.
//
// Le « Nth win » est la monnaie du fandom — kprofiles en publie une page par
// mois, les comptes de récap X en font leur hebdo — et il n'apparaissait nulle
// part chez nous alors qu'il transitait déjà dans le parseur.
//
// Le format wikitext d'une ligne (vérifié sur les 6 pages 2026) :
//
//   ! scope="row" style="text-align:center" | 1,275
//   | {{dts|January 9}}
//   | [[Say My Name (group)|Say My Name]]<!-- 1st -->
//   | "UFO (Attention)"
//   | 11,912
//   | <ref>…</ref>
//
// Trois pièges que le parseur DOIT gérer, tous présents dans les pages réelles :
//
//  1. `rowspan` — quand un artiste gagne deux semaines de suite, la seconde
//     ligne N'A PAS de cellule artiste ni chanson. Lues positionnellement, ses
//     points passeraient pour le nom de l'artiste. Le commentaire porte alors
//     les DEUX rangs (`<!-- 11th, 12th-->`), un par ligne couverte.
//  2. `{{N/A}}` en cellule épisode — une semaine sans numéro (spéciale, ou
//     émission non comptée). Ce n'est pas une erreur, c'est une absence.
//  3. Wikilinks pipés (`[[Ive (group)|Ive]]`), styles inline et `<ref>` qui
//     contiennent des `|` et des sauts de ligne à foison.

export interface ChartWinner {
  /** Jour KST de l'épisode, 'YYYY-MM-DD'. */
  date: string
  /** Numéro d'épisode quand la page en donne un ({{N/A}} → null). */
  episode: number | null
  /** Nom d'affichage de l'artiste, wikilink résolu. */
  artist: string
  /** Titre de la chanson, guillemets et wikilink retirés. */
  song: string | null
  /** Rang de victoire pour CETTE date (« 11th » → 11), null si absent. */
  nth: number | null
}

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
}

/** Les `<ref>` contiennent des `|`, des `\n` et des tables : on les efface
    AVANT tout découpage, sinon ils passent pour des cellules. */
function stripRefs(text: string): string {
  return text.replace(/<ref[^>]*\/>/g, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '')
}

/** `[[Page|Affiché]]` → `Affiché` ; `[[Nmixx]]` → `Nmixx`. */
function unwrapLinks(text: string): string {
  return text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1')
}

/** Rangs portés par le commentaire d'une cellule artiste : `<!-- 15th, 16th,
    17th-->` → [15, 16, 17]. Un par ligne couverte par le rowspan. */
function parseOrdinals(raw: string): number[] {
  const out: number[] = []
  for (const c of raw.matchAll(/<!--([^>]*?)-->/g)) {
    for (const n of c[1].matchAll(/(\d+)\s*(?:st|nd|rd|th)\b/gi)) out.push(Number(n[1]))
  }
  return out
}

/** `{{N/a|No show, winner not announced}}`, `{{N/A}}`, `{{n/a}}` : une cellule
    VIDE, pas un contenu. Sans ce test, le paramètre du template devenait le nom
    de l'artiste — « No show, winner not announced » sortait en vainqueur sur
    4 des 6 shows. */
const NA_TEMPLATE = /\{\{\s*n\/a\s*(\||\}\})/i

/** Contenu utile d'une cellule : attributs (`rowspan="2" | …`) et balisage
    retirés. Renvoie aussi les spans déclarés. */
function readCell(raw: string): { text: string; rowspan: number; colspan: number } {
  const rowspan = Number(/rowspan\s*=\s*"?(\d+)/i.exec(raw)?.[1] ?? 1)
  const colspan = Number(/colspan\s*=\s*"?(\d+)/i.exec(raw)?.[1] ?? 1)
  // Un `|` sépare les attributs du contenu — mais seulement si la partie
  // gauche ressemble à des attributs. Piège réel : `style="background:#FFDEAD;`
  // (guillemet jamais fermé sur la page Inkigayo) — la détection porte donc sur
  // la présence d'un `=`, pas sur un parsing d'attributs.
  let body = raw
  const bar = raw.indexOf('|')
  if (bar >= 0) {
    const left = raw.slice(0, bar)
    if (/^[\s\w-]*=/.test(left) || left.trim() === '') body = raw.slice(bar + 1)
  }
  const text = NA_TEMPLATE.test(raw) ? '' : body.trim()
  return { text, rowspan: Math.max(1, rowspan), colspan: Math.max(1, colspan) }
}

/** Templates résiduels d'une cellule de contenu (`{{dagger}}`, `{{Efn|…}}`) :
    ils ne font partie ni du nom ni du titre. Boucle bornée pour les imbriqués. */
function stripTemplates(text: string): string {
  let out = text
  for (let i = 0; i < 4; i++) {
    const next = out.replace(/\{\{[^{}]*\}\}/g, '')
    if (next === out) break
    out = next
  }
  return out
}

/** Découpe une ligne de table en cellules brutes (une par ligne wikitext,
    `||` toléré). */
function splitCells(rowBlock: string): string[] {
  const cells: string[] = []
  for (const line of rowBlock.split('\n')) {
    const t = line.trim()
    if (!t.startsWith('|') && !t.startsWith('!')) {
      // Continuation d'une cellule multi-lignes (rare) : on recolle.
      if (cells.length > 0 && t) cells[cells.length - 1] += ` ${t}`
      continue
    }
    const marker = t[0]
    const rest = t.slice(1)
    for (const part of rest.split(marker === '!' ? '!!' : '||')) cells.push(part)
  }
  return cells
}

interface Carry {
  col: number
  text: string
  ordinals: number[]
  /** Lignes restantes à couvrir, et rang de la ligne courante dans le span. */
  remaining: number
  index: number
}

const EPISODE = 0
const DATE = 1
const ARTIST = 2
const SONG = 3
const COLUMNS = 4

/**
 * Extrait les vainqueurs d'une page « Chart winners ».
 *
 * `year` = année de la page : les dates y sont écrites sans année
 * (`{{dts|January 9}}`), sauf exception que l'on respecte si elle apparaît.
 */
export function parseChartWinners(wikitext: string, year: number): ChartWinner[] {
  // La page contient plusieurs tables (barème, légende) : seule celle qui suit
  // « Chart history » porte les vainqueurs.
  const start = wikitext.indexOf('==Chart history==')
  const body = start >= 0 ? wikitext.slice(start) : wikitext
  const clean = stripRefs(body)

  const out: ChartWinner[] = []
  const carries: Carry[] = []

  for (const rowBlock of clean.split(/^\s*\|-.*$/m)) {
    const raw = splitCells(rowBlock)
    if (raw.length === 0) continue

    // Résolution des rowspans : on place d'abord les cellules héritées à leur
    // colonne d'origine, puis les cellules propres dans les trous.
    const slots: ({ text: string; ordinals: number[]; spanIndex: number } | null)[] = Array.from(
      { length: COLUMNS },
      () => null,
    )
    for (const c of carries) {
      if (c.remaining > 0 && c.col < COLUMNS) {
        slots[c.col] = { text: c.text, ordinals: c.ordinals, spanIndex: c.index }
      }
    }

    // Les reports EXISTANTS consomment une ligne — surtout pas ceux qu'on
    // s'apprête à créer. Décrémenter en bloc APRÈS placement faisait expirer un
    // `rowspan="2"` dans la ligne même qui le déclarait : la ligne suivante
    // décalait tout d'un cran et lisait les POINTS comme nom d'artiste
    // (Inkigayo #1295 sortait « 6,045 » en vainqueur).
    for (const c of carries) {
      c.remaining -= 1
      c.index += 1
    }

    let col = 0
    let placedAny = false
    for (const cellRaw of raw) {
      while (col < COLUMNS && slots[col] !== null) col++
      if (col >= COLUMNS) break
      const { text, rowspan, colspan } = readCell(cellRaw)
      const ordinals = parseOrdinals(cellRaw)
      // Un `colspan` couvre plusieurs colonnes : la cellule « No show » de
      // Inkigayo en couvre trois (artiste + chanson + points).
      const width = Math.min(colspan, COLUMNS - col)
      for (let k = 0; k < width; k++) {
        slots[col + k] = { text: k === 0 ? text : '', ordinals, spanIndex: 0 }
      }
      placedAny = true
      if (rowspan > 1) {
        carries.push({ col, text, ordinals, remaining: rowspan - 1, index: 1 })
      }
      col += width
    }

    for (let i = carries.length - 1; i >= 0; i--) {
      if (carries[i].remaining <= 0) carries.splice(i, 1)
    }

    if (!placedAny) continue

    const dateCell = slots[DATE]?.text ?? ''
    const dts = /\{\{dts\|([A-Za-z]+)\s+(\d{1,2})(?:,?\s*(\d{4}))?\}\}/.exec(dateCell)
    if (!dts) continue
    const month = MONTHS[dts[1].toLowerCase()]
    const day = Number(dts[2])
    if (!month || !day) continue
    const y = dts[3] ? Number(dts[3]) : year

    const artistSlot = slots[ARTIST]
    const artist = stripTemplates(unwrapLinks(artistSlot?.text ?? ''))
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/'''?/g, '')
      .replace(/[\s†‡*]+$/u, '')
      .trim()
    if (!artist) continue

    const episodeRaw = slots[EPISODE]?.text ?? ''
    const episodeDigits = /^\s*([\d,]+)\s*$/.exec(episodeRaw.replace(/<!--[\s\S]*?-->/g, ''))
    const episode = episodeDigits ? Number(episodeDigits[1].replace(/,/g, '')) : null

    const song =
      stripTemplates(unwrapLinks(slots[SONG]?.text ?? ''))
        .replace(/<!--[\s\S]*?-->/g, '')
        // Les marqueurs de note de bas de page (†, ‡, *) sont parfois écrits
        // en CARACTÈRE et pas en template : `"Pretty Girl" †` sortait avec son
        // dague et un guillemet orphelin. On les retire AVANT les guillemets,
        // sinon le guillemet fermant n'est plus en fin de chaîne.
        .replace(/[\s†‡*]+$/u, '')
        .trim()
        .replace(/^"+|"+$/g, '')
        .trim() || null

    // Rang de CETTE ligne dans le span (0 pour une ligne simple).
    const ordinals = artistSlot?.ordinals ?? []
    const nth = ordinals[artistSlot?.spanIndex ?? 0] ?? null

    out.push({
      date: `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      episode,
      artist,
      song,
      nth,
    })
  }
  return out
}
