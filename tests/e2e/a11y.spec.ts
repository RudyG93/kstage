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
  // Les deux pages qui portent la zone COMMENTAIRES n'étaient pas scannées —
  // c'est là que vivent les formulaires, donc les noms accessibles.
  { nom: 'page MV (discussion)', path: '/mv/aespa-rich-man-yellow-claw-remix-mv' },
  { nom: 'page épisode (discussion)', path: '/show/inkigayo/2026-08-16' },
]

/**
 * DETTE DE PALETTE SOLDÉE le 2026-08-24 — cette liste est vide et doit le
 * rester.
 *
 * `/calendar` tolérait `color-contrast` : 19 violations sur des jetons en
 * petit texte. Elles avaient trois causes, pas une : (1) un `text-faint/60`
 * sur les jours hors-mois, (2) un `opacity-60` qui était le seul signal
 * actif/inactif des chips de filtre, (3) trois jetons du thème clair posés sur
 * leur PROPRE teinte, qui perdaient 0,5 point de ratio à chaque fois. Les
 * trois sont corrigés ; le scan rend 0 nœud sérieux sur 5 pages × 2 thèmes.
 *
 * Y remettre `color-contrast` reviendrait à ré-autoriser la classe entière.
 */
const DETTE_CALENDRIER: readonly string[] = []

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

  // Le calendrier, dans les deux thèmes — et ce sont bien DEUX thèmes depuis
  // le 2026-08-24 : `emulateMedia` n'avait jamais rien changé.
  for (const theme of ['dark', 'light'] as const) {
    test(`calendrier (${theme}) : aucune violation sérieuse`, async ({ page }) => {
      test.skip(test.info().project.name !== 'chromium', 'axe : chromium seulement')
      // `emulateMedia` ne pouvait RIEN : le layout monte next-themes avec
      // `enableSystem={false}` (layout.tsx), donc `prefers-color-scheme` est
      // ignoré et les deux runs scannaient le sombre. Le thème se pose là où
      // l'application le lit — le stockage, avant le premier rendu.
      await page.addInitScript((t) => {
        window.localStorage.setItem('theme', t)
      }, theme)
      await page.goto('/calendar')
      await settle(page)
      // Garde-fou : si le thème ne s'applique pas, le test doit échouer ici et
      // non se transformer en second scan du sombre.
      await expect(page.locator('html')).toHaveClass(new RegExp(`(^|\\s)${theme}(\\s|$)`))
      const ids = (await scan(page)).map((v) => v.split(' ')[0])
      expect([...new Set(ids)].filter((id) => !DETTE_CALENDRIER.includes(id))).toEqual([])
    })
  }
})
