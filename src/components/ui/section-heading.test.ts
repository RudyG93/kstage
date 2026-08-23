import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

// Garde anti-régression a11y : un titre de SECTION doit être un heading, pas
// un <span> stylé. Le correctif §8.6 avait converti PanelHeader en <h2> mais
// laissé douze `<span className="label-data">` écrits à la main sur les pages
// détail — invisibles à la revue parce que le rendu est identique (Preflight
// neutralise taille et marge des headings), et aucune règle jsx-a11y ne les
// détecte.
//
// La liste est explicite : un `label-data` en <span> reste légitime quand il
// étiquette une donnée (« 260 groups & soloists ») et non une section.
const SECTION_FILES = [
  'src/app/artists/[slug]/page.tsx',
  'src/app/groups/[slug]/page.tsx',
  'src/app/mv/[slug]/page.tsx',
  'src/app/u/[username]/page.tsx',
  'src/components/mv/drops-grid.tsx',
]

describe('titres de section', () => {
  it('les pages détail ne titrent pas une section avec un <span>', () => {
    const offenders: string[] = []
    for (const file of SECTION_FILES) {
      const src = readFileSync(file, 'utf8')
      for (const m of src.matchAll(/<span className="label-data">/g)) {
        const line = src.slice(0, m.index).split('\n').length
        offenders.push(`${file}:${line}`)
      }
    }
    expect(offenders).toEqual([])
  })
})
