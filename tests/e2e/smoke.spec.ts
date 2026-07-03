import { test, expect } from '@playwright/test'

// Smoke déconnecté : Landing (Data Desk §7.9) + calendar accessible.

test.describe('Landing (logged out)', () => {
  test('hero + preuve live + mur visuel + double CTA', async ({ page }) => {
    await page.goto('/')

    // Hero : h1 + badge live + double CTA.
    await expect(
      page.getByRole('heading', { level: 1, name: /never miss a\s*comeback again/i }),
    ).toBeVisible()
    await expect(page.getByText(/events tracked live/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /create your calendar — free/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /browse the calendar first/i })).toBeVisible()

    // 3 étapes : au moins la première (first() : le sous-titre du hero contient
    // aussi « Follow your groups »).
    await expect(page.getByText(/follow your groups/i).first()).toBeVisible()

    // Mur visuel : label « n groups & soloists » (groupes seedés en prod).
    await expect(page.getByText(/groups & soloists/i)).toBeVisible()
  })

  test('CTA principal navigue vers /signup, CTA secondaire vers /calendar', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /create your calendar — free/i }).click()
    await expect(page).toHaveURL(/\/signup$/)

    await page.goto('/')
    await page.getByRole('link', { name: /browse the calendar first/i }).click()
    await expect(page).toHaveURL(/\/calendar$/)
  })
})

test.describe('Calendar', () => {
  const MONTH_PAGER = /\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+\d{4}\b/

  test('month grid renders + has next/prev navigation', async ({ page }) => {
    await page.goto('/calendar')
    // h1 « Calendar » (Data Desk) + pager de mois « ‹ JUL 2026 › ».
    await expect(page.getByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible()
    await expect(page.getByText(MONTH_PAGER)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Next month' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Previous month' })).toBeVisible()
  })

  // Teste le câblage réel de la navigation (Next/Prev re-rendent le mois), pas
  // juste la présence des liens. Déterministe : on assert le changement du
  // pager (URL + texte) et le retour — PAS qu'un event précis s'affiche.
  test('next/previous month re-render the grid for the new month', async ({ page }) => {
    await page.goto('/calendar')
    const pager = page.getByText(MONTH_PAGER).first()
    const initial = (await pager.textContent())?.trim() ?? ''
    expect(initial).not.toBe('')

    await page.getByRole('link', { name: 'Next month' }).click()
    await expect(page).toHaveURL(/[?&]month=\d{4}-\d{2}/)
    await expect(pager).not.toHaveText(initial) // le mois affiché a changé

    await page.getByRole('link', { name: 'Previous month' }).click()
    await expect(pager).toHaveText(initial) // retour au mois de départ
  })
})
