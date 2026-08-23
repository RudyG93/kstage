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
  { nom: 'annuaire', path: '/groups' },
  { nom: 'drops', path: '/mvs' },
  { nom: 'recherche (vide)', path: '/search' },
  { nom: 'index des shows', path: '/shows' },
]

/**
 * `/calendar` a une DETTE de palette, pas un défaut de structure.
 *
 * Une fois le streaming attendu (cf. `settle`), axe y trouve 19 violations de
 * contraste, toutes sur des jetons de design utilisés en petit texte :
 * `--faint` à 2.47:1 sur les chips de filtre, `--teal` à 3.90, `--amber` à
 * 3.58, et `text-faint/60` à 2.60 sur les cases de jour vides. Corriger
 * demande de retoucher la palette — une décision de design, pas un correctif.
 *
 * Le test ne l'ignore donc pas : il verrouille le fait que le contraste est le
 * SEUL problème sérieux de cette page. Toute violation d'une autre nature
 * (nom accessible manquant, rôle incohérent, hiérarchie de titres) fera
 * échouer. Le jour où la palette passe, cette liste redevient vide.
 */
const DETTE_CALENDRIER = ['color-contrast']

/**
 * Attendre que la page ait FINI de streamer avant de scanner.
 *
 * Sans ça le test est flaky : les pages sont streamées (Suspense), et axe
 * scannait parfois des squelettes — dont le contraste n'a jamais été pensé
 * pour être lu. Constaté le 2026-08-23 : le scan du thème clair échouait dans
 * la suite complète (serveur chargé, plusieurs projets en parallèle) et
 * passait systématiquement lancé seul.
 *
 * `.animate-pulse` est exactement le marqueur de « pas encore rendu » :
 * attendre sa disparition est plus précis qu'un `networkidle`.
 */
async function settle(page: Page) {
  await expect(page.locator('h1').first()).toBeVisible()
  await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15_000 })
}

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
      await settle(page)
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
    await settle(page)
    expect(await scan(page)).toEqual([])
  })

  // Le calendrier, dans les deux thèmes : seule la dette de palette est tolérée.
  for (const theme of ['dark', 'light'] as const) {
    test(`calendrier (${theme}) : aucune violation hors dette de palette`, async ({ page }) => {
      test.skip(test.info().project.name !== 'chromium', 'axe : chromium seulement')
      await page.emulateMedia({ colorScheme: theme })
      await page.goto('/calendar')
      await settle(page)
      const ids = (await scan(page)).map((v) => v.split(' ')[0])
      expect([...new Set(ids)].filter((id) => !DETTE_CALENDRIER.includes(id))).toEqual([])
    })
  }
})
