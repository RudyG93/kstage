import { describe, expect, it } from 'vitest'
import { pageCouvreLeConnu } from './youtube'

// Le run quotidien tirait TOUJOURS 2 pages d'uploads (100 vidéos) par source,
// même quand rien n'avait bougé : 40 000 vidéos relues par jour pour 52
// insertions au mieux, et zéro certains jours (scrape_log 2026-08-20 :
// 1 255 units, 0 insert). La règle d'arrêt doit économiser ce second appel
// SANS jamais rater une sortie.
const d = (iso: string) => Date.parse(iso)
const page = (...isos: string[]) => isos.map((publishedAt) => ({ publishedAt }))

describe('pageCouvreLeConnu', () => {
  it("s'arrête quand la page descend sous le MV le plus récent connu", () => {
    // La plus ancienne de la page (05/08) précède le repère (10/08) : tout ce
    // qui suit est plus ancien encore, donc déjà vu.
    expect(pageCouvreLeConnu(page('2026-08-20', '2026-08-05'), d('2026-08-10'))).toBe(true)
  })

  it('continue quand toute la page est plus récente que le repère', () => {
    // Une chaîne qui a publié plus d'une page depuis le dernier run : la queue
    // de la fenêtre est peut-être encore inédite, il faut la page suivante.
    expect(pageCouvreLeConnu(page('2026-08-20', '2026-08-15'), d('2026-08-10'))).toBe(false)
  })

  it('ne conclut jamais sans repère — une source neuve doit remonter son historique', () => {
    expect(pageCouvreLeConnu(page('2026-08-20', '2026-08-01'), null)).toBe(false)
  })

  it("ne conclut jamais sur une page vide : l'absence de preuve n'est pas une preuve", () => {
    expect(pageCouvreLeConnu([], d('2026-08-10'))).toBe(false)
  })

  it('ignore les dates illisibles plutôt que de les traiter comme anciennes', () => {
    // Date.parse rend NaN ; un NaN pris pour 0 déclencherait un arrêt à tort
    // dès la première page et masquerait les sorties suivantes.
    expect(pageCouvreLeConnu(page('pas-une-date'), d('2026-08-10'))).toBe(false)
    expect(pageCouvreLeConnu(page('pas-une-date', '2026-08-15'), d('2026-08-10'))).toBe(false)
  })

  it('ne s’arrête pas quand la page s’arrête pile sur le repère', () => {
    // Égalité stricte exclue : le MV connu est peut-être le dernier de la page,
    // et le suivant (plus ancien d'une seconde) serait sur la page d'après.
    expect(pageCouvreLeConnu(page('2026-08-10'), d('2026-08-10'))).toBe(false)
  })
})
