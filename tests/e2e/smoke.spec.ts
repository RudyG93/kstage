import { test, expect } from '@playwright/test'

// Smoke déconnecté : Landing (post-redesign) + calendar accessible.
// L'ancienne suite testait la home connectée (heading "Upcoming", filtre
// group/type) — déplacée dans le golden path `auth.spec.ts` car le layout
// 3 colonnes + le filtre multi sont gated sur l'auth.

test.describe('Landing (logged out)', () => {
  test('hero CTA + features + groups grid render', async ({ page }) => {
    await page.goto('/')

    // Hero : heading h1 + CTA Get started / Sign in.
    await expect(
      page.getByRole('heading', { level: 1, name: /never miss a comeback again/i }),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: /get started/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /^sign in$/i })).toBeVisible()

    // Features : au moins l'un des 3 cards.
    await expect(page.getByRole('heading', { level: 2, name: /follow your groups/i })).toBeVisible()

    // Groups grid : section "Track your groups" rendue (les groupes sont seedés
    // en prod donc la grille de photos n'est jamais vide).
    await expect(page.getByRole('heading', { level: 2, name: /track your groups/i })).toBeVisible()
  })

  test('CTA Get started navigates to /signup', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /get started/i }).click()
    await expect(page).toHaveURL(/\/signup$/)
  })
})

test.describe('Calendar', () => {
  const MONTH_TITLE =
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/

  test('month grid renders + has next/prev navigation', async ({ page }) => {
    await page.goto('/calendar')
    // h1 = le mois courant (ex. « June 2026 »), pas un libellé « Calendar » figé
    // (retiré lors d'un redesign ; le titre de mois est l'en-tête de page).
    await expect(page.getByRole('heading', { level: 1, name: MONTH_TITLE })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Next month' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Previous month' })).toBeVisible()
  })

  // Teste le câblage réel de la navigation (Next/Prev re-rendent le mois), pas
  // juste la présence des liens. Déterministe : on assert le changement de mois
  // (URL + titre) et le retour — PAS qu'un event précis s'affiche (la data prod
  // change → ce serait flaky ; c'est la nav qu'on vérifie ici).
  test('next/previous month re-render the grid for the new month', async ({ page }) => {
    await page.goto('/calendar')
    const title = page.getByRole('heading', { level: 1 }).filter({ hasText: MONTH_TITLE }).first()
    const initial = (await title.textContent())?.trim() ?? ''
    expect(initial).not.toBe('')

    await page.getByRole('link', { name: 'Next month' }).click()
    await expect(page).toHaveURL(/[?&]month=\d{4}-\d{2}/)
    await expect(title).not.toHaveText(initial) // le mois affiché a changé

    await page.getByRole('link', { name: 'Previous month' }).click()
    await expect(title).toHaveText(initial) // retour au mois de départ
  })
})
