import { test, expect } from '@playwright/test'

// /search (refonte 2026-07-03) : la route la plus interactive de l'app.
// Déterministe : on teste le câblage (debounce → URL, segments, empty states),
// pas le contenu exact des résultats (la data prod bouge). Seul invariant data
// utilisé : le groupe seed « aespa » existe en prod depuis le MVP.
//
// TOUTES les assertions sont scopées au <main> : la recherche du header rend
// son propre panneau (« Top result », « No results for… », hint) dès que `q`
// est dans l'URL → doublons DOM = strict mode violation. En dev l'hydratation
// lente masquait la course ; contre un build prod (CI) elle éclate.

test.describe('Search', () => {
  test('empty state : hint visible + input focus', async ({ page }) => {
    await page.goto('/search')
    const main = page.getByRole('main')
    await expect(main.getByText(/search covers groups, artists, mvs and events/i)).toBeVisible()
    await expect(main.getByRole('searchbox', { name: 'Search' })).toBeFocused()
  })

  test('SSR direct ?q=aespa : top result + lien fiche groupe', async ({ page }) => {
    await page.goto('/search?q=aespa')
    const main = page.getByRole('main')
    await expect(main.getByText('Top result')).toBeVisible()
    await expect(main.getByRole('link', { name: /aespa/i }).first()).toHaveAttribute(
      'href',
      /\/groups\/aespa$/,
    )
  })

  test('recherche live : saisie debouncée → URL ?q= + résultats', async ({ page }) => {
    await page.goto('/search')
    const main = page.getByRole('main')
    await main.getByRole('searchbox', { name: 'Search' }).fill('aespa')
    // Debounce 300 ms puis router.replace : l'URL porte la requête.
    await expect(page).toHaveURL(/[?&]q=aespa/)
    await expect(main.getByText('Top result')).toBeVisible()
  })

  test('segments : groups → URL seg= + aria-current', async ({ page }) => {
    await page.goto('/search?q=aespa')
    const scope = page.getByRole('navigation', { name: 'Search scope' })
    await scope.getByRole('link', { name: 'groups', exact: true }).click()
    await expect(page).toHaveURL(/[?&]seg=groups/)
    await expect(scope.getByRole('link', { name: 'groups', exact: true })).toHaveAttribute(
      'aria-current',
      'true',
    )
    // Retour « all » : le param seg disparaît.
    await scope.getByRole('link', { name: 'all', exact: true }).click()
    await expect(page).not.toHaveURL(/[?&]seg=/)
  })

  test('no results : empty state + lien Browse groups', async ({ page }) => {
    await page.goto('/search?q=zzzqqqxx')
    const main = page.getByRole('main')
    await expect(main.getByText(/no results for/i)).toBeVisible()
    await expect(main.getByRole('link', { name: /browse groups/i })).toHaveAttribute(
      'href',
      '/groups',
    )
  })

  test('clear : la croix vide la requête et réaffiche le hint', async ({ page }) => {
    await page.goto('/search?q=aespa')
    const main = page.getByRole('main')
    await expect(main.getByText('Top result')).toBeVisible()
    await main.getByRole('button', { name: 'Clear search' }).click()
    await expect(page).not.toHaveURL(/[?&]q=/)
    await expect(main.getByText(/search covers groups, artists, mvs and events/i)).toBeVisible()
  })
})
