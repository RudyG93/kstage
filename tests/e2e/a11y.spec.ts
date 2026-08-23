import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * Filet anti-régression a11y — pas un certificat de conformité.
 *
 * axe automatisé couvre 30 à 40 % des critères WCAG : il attrape les contrastes,
 * les noms accessibles manquants, les rôles incohérents, la hiérarchie de
 * titres. Il ne dit RIEN de l'ordre de tabulation ni des pièges de focus, qui
 * restent à vérifier à la main.
 *
 * Ce qu'il protège concrètement : les correctifs de contraste du Lot 4 et les
 * douze titres de section passés en `<h2>` le 2026-08-23 — deux corrections
 * qu'aucun test ne gardait.
 *
 * Chromium seul (le moteur, pas le viewport, décide de ce qu'axe voit), et
 * `/admin` exclu : ce n'est pas une surface publique.
 */
const GABARITS: { nom: string; path: string }[] = [
  { nom: 'landing', path: '/' },
  { nom: 'calendrier', path: '/calendar' },
  { nom: 'annuaire', path: '/groups' },
  { nom: 'drops', path: '/mvs' },
  { nom: 'recherche (vide)', path: '/search' },
  { nom: 'index des shows', path: '/shows' },
]

/** Les violations sérieuses seulement : `minor` remonte du bruit de contraste
    sur des éléments décoratifs, et on veut un test qui ne crie que pour de
    vrai. */
async function scan(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} (${v.impact}) × ${v.nodes.length} — ${v.help}`)
}

test.describe('Accessibilité', () => {
  for (const { nom, path } of GABARITS) {
    test(`${nom} : aucune violation sérieuse`, async ({ page }) => {
      test.skip(test.info().project.name !== 'chromium', 'axe : chromium seulement')
      await page.goto(path)
      expect(await scan(page)).toEqual([])
    })
  }

  // Slugs DÉCOUVERTS par clic, jamais codés en dur : la donnée de test est la
  // prod, un slug figé casse le jour où le groupe est renommé.
  test('page groupe : aucune violation sérieuse', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'axe : chromium seulement')
    await page.goto('/groups')
    await page.getByRole('main').getByRole('link', { name: /./ }).first().click()
    await expect(page).toHaveURL(/\/(groups|artists)\//)
    expect(await scan(page)).toEqual([])
  })

  // Le thème clair n'était protégé par rien — les correctifs de contraste du
  // Lot 4 y vivent pourtant.
  test('thème clair : aucune violation sérieuse', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'axe : chromium seulement')
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/calendar')
    expect(await scan(page)).toEqual([])
  })
})
