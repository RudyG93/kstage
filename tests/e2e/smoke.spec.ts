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

    // Groups grid : section "Now tracking" rendue (les groupes sont seedés
    // en prod donc la liste n'est jamais vide).
    await expect(page.getByRole('heading', { level: 2, name: /now tracking/i })).toBeVisible()
  })

  test('CTA Get started navigates to /signup', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /get started/i }).click()
    await expect(page).toHaveURL(/\/signup$/)
  })
})

test.describe('Calendar', () => {
  test('month grid renders + has next/prev navigation', async ({ page }) => {
    await page.goto('/calendar')
    await expect(page.getByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Next month' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Previous month' })).toBeVisible()
  })
})
