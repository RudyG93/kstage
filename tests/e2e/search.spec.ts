import { test, expect } from '@playwright/test'

// /search (refonte 2026-07-03) : la route la plus interactive de l'app.
// Déterministe : on teste le câblage (debounce → URL, segments, empty states),
// pas le contenu exact des résultats (la data prod bouge). Seul invariant data
// utilisé : le groupe seed « aespa » existe en prod depuis le MVP.

test.describe('Search', () => {
  test('empty state : hint visible + input focus', async ({ page }) => {
    await page.goto('/search')
    await expect(page.getByText(/search covers groups, artists, mvs and events/i)).toBeVisible()
    // Deux searchbox coexistent (header + page) : on cible celle de la page.
    await expect(page.getByRole('main').getByRole('searchbox', { name: 'Search' })).toBeFocused()
  })

  test('SSR direct ?q=aespa : top result + lien fiche groupe', async ({ page }) => {
    await page.goto('/search?q=aespa')
    await expect(page.getByText('Top result')).toBeVisible()
    await expect(page.getByRole('link', { name: /aespa/i }).first()).toHaveAttribute(
      'href',
      /\/groups\/aespa$/,
    )
  })

  test('recherche live : saisie debouncée → URL ?q= + résultats', async ({ page }) => {
    await page.goto('/search')
    await page.getByRole('main').getByRole('searchbox', { name: 'Search' }).fill('aespa')
    // Debounce 300 ms puis router.replace : l'URL porte la requête.
    await expect(page).toHaveURL(/[?&]q=aespa/)
    await expect(page.getByText('Top result')).toBeVisible()
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
    await expect(page.getByText(/no results for/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /browse groups/i })).toHaveAttribute(
      'href',
      '/groups',
    )
  })

  test('clear : la croix vide la requête et réaffiche le hint', async ({ page }) => {
    await page.goto('/search?q=aespa')
    await expect(page.getByText('Top result')).toBeVisible()
    await page.getByRole('button', { name: 'Clear search' }).click()
    await expect(page).not.toHaveURL(/[?&]q=/)
    await expect(page.getByText(/search covers groups, artists, mvs and events/i)).toBeVisible()
  })
})
