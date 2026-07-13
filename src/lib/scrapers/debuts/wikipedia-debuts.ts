/**
 * Signal de NOTABILITÉ pour le gate d'auto-création des debuts (R4-I) : les
 * sections « Debuting groups » / « Solo debuts » de la page Wikipedia
 * « {year} in South Korean music » (wikitext brut, même source que
 * wikipedia-releases). Un groupe présent ici est couvert par la presse — un
 * projet nugu de la catégorie fandom n'y figure pas (protège le page-pruning
 * acté : pas de re-création de pages vides).
 */
import { wikitextUrl } from '@/lib/scrapers/wikipedia-releases'

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '')

/**
 * Noms (normalisés) listés dans les sections de debuts. Set vide en cas
 * d'échec réseau — le gate retombe alors sur les autres signaux.
 */
export async function fetchWikipediaDebutNames(year: number): Promise<Set<string>> {
  try {
    const res = await fetch(wikitextUrl(year))
    if (!res.ok) return new Set()
    const wt = await res.text()
    const names = new Set<string>()
    // Sections === Debuting groups === / === Solo debuts === (et variantes) :
    // items « * [[Name]] » ou « * Name » jusqu'à la prochaine section.
    const sectionRe = /===?\s*(?:Debuting groups|Solo debuts|Debuts)\s*===?\n([\s\S]*?)(?=\n==)/gi
    for (const section of wt.matchAll(sectionRe)) {
      for (const line of section[1].split('\n')) {
        if (!line.startsWith('*')) continue
        const link = /\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/.exec(line)
        const raw = link ? link[1] : line.replace(/^\*+\s*/, '').split(/[–—(<]/)[0]
        const n = norm(raw)
        if (n) names.add(n)
      }
    }
    return names
  } catch {
    return new Set()
  }
}

export { norm as normalizeDebutName }
