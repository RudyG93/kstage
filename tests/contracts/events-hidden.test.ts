import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Contrat de confiance : un event `hidden=true` (masqué depuis l'admin) ne doit
// JAMAIS fuir vers une surface user-facing. Toute lecture publique de la table
// `events` doit filtrer `hidden`. Cette garde échoue si une nouvelle requête
// `.from('events')` oublie le filtre — c'est exactement la classe de bug qui
// avait laissé 13 surfaces exposées (push, digest, iCal, sitemap, page MV, Top
// Rated, compteurs, images OG).

const SRC = resolve(process.cwd(), 'src')

// Fichiers où `.from('events')` est une ÉCRITURE (scrapers, actions, ingest) ou
// une lecture ADMIN (qui DOIT voir les masqués). Y ajouter tout nouveau
// writer/admin sciemment — ne jamais y mettre une lecture user-facing.
const EXEMPT = new Set([
  'lib/events/actions.ts',
  'app/admin/events/page.tsx',
  'lib/scrapers/debuts/ingest.ts',
  'lib/scrapers/music-shows/stage-links.ts',
  'app/api/cron/scrape-music-shows/route.ts',
  'lib/scrapers/youtube.ts',
  'lib/scrapers/comeback-ingest.ts',
  'lib/suggestions/actions.ts',
])

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full)
  }
  return out
}

const NEEDLE = ".from('events')"

describe('events.hidden filtré sur toute lecture publique', () => {
  const readers = walk(SRC)
    .map((file) => ({
      rel: relative(SRC, file).replace(/\\/g, '/'),
      content: readFileSync(file, 'utf8'),
    }))
    .filter(({ rel, content }) => content.includes(NEEDLE) && !EXEMPT.has(rel))

  it('couvre au moins les lecteurs publics connus (garde contre un EXEMPT trop large)', () => {
    expect(readers.length).toBeGreaterThanOrEqual(9)
  })

  for (const { rel, content } of readers) {
    it(`${rel} filtre hidden sur chaque .from('events')`, () => {
      let idx = content.indexOf(NEEDLE)
      while (idx !== -1) {
        // La chaîne query-builder tient largement dans 700 caractères.
        const window = content.slice(idx, idx + 700)
        expect(window, `.from('events') sans filtre hidden dans ${rel}`).toMatch(/hidden/)
        idx = content.indexOf(NEEDLE, idx + 1)
      }
    })
  }
})
