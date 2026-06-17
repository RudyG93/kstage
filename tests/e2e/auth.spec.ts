import { test, expect } from '@playwright/test'

// Golden path : login → follow → filtres sidebar → mes events → logout.
// Utilise un compte test fixe (confirmé côté Supabase) fourni via env.
// Skip proprement si non configuré, pour ne pas casser la CI.
const email = process.env.E2E_AUTH_EMAIL ?? ''
const password = process.env.E2E_AUTH_PASSWORD ?? ''

test.describe('auth golden path', () => {
  test.skip(
    !email || !password,
    'Set E2E_AUTH_EMAIL / E2E_AUTH_PASSWORD (a confirmed Supabase user) to run.',
  )

  test('sign in, follow, multi-filter, connected home, sign out', async ({ page }) => {
    // Sign in → redirigé vers l'accueil connecté `/` (l'ancienne route `/my`
    // a été retirée ; ce test l'attendait encore mais ne tournait jamais).
    await page.goto('/login')
    await page.getByLabel('Email or username').fill(email)
    // `exact` : sinon "Password" matche aussi le bouton "Show password".
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/$/)

    // Suivre un groupe. Le bouton de suivi des cards est un cœur icon-only :
    // son nom accessible est "Follow" / "Unfollow" (aria-label), pas du texte.
    await page.goto('/groups')
    const firstFollow = page.getByRole('button', { name: 'Follow' }).first()
    if (await firstFollow.count()) await firstFollow.click()
    await expect(page.getByRole('button', { name: 'Unfollow' }).first()).toBeVisible()

    // Home connectée : sidebar gauche TypeFilterVertical (post round-4 layout).
    await page.goto('/')

    // 1er filtre : "MV" → URL contient `type=mv`.
    const mvBtn = page.getByRole('button', { name: 'MV', exact: true })
    await mvBtn.scrollIntoViewIfNeeded()
    await mvBtn.click()
    await expect(page).toHaveURL(/[?&]type=mv(?:[,&]|$)/)
    await expect(mvBtn).toHaveAttribute('aria-pressed', 'true')

    // 2e filtre : "Release" → URL CSV `type=mv,release` (insertion order).
    const releaseBtn = page.getByRole('button', { name: 'Release', exact: true })
    await releaseBtn.click()
    await expect(page).toHaveURL(/[?&]type=mv,release(?:[,&]|$)/)
    await expect(releaseBtn).toHaveAttribute('aria-pressed', 'true')

    // Re-click MV → URL ne contient plus que `release`.
    await mvBtn.click()
    await expect(page).toHaveURL(/[?&]type=release(?:[,&]|$)/)
    await expect(mvBtn).toHaveAttribute('aria-pressed', 'false')

    // La home connectée affiche la sidebar "My groups" (preuve d'état connecté
    // + au moins un groupe suivi → l'empty-state a disparu).
    await expect(page.getByText('My groups')).toBeVisible()
    await expect(page.getByText("You don't follow any groups yet.")).toHaveCount(0)

    // Sign out → ouvrir le menu compte (avatar) puis Sign out → retour à l'accueil.
    await page.getByRole('button', { name: 'Account menu' }).click()
    await page.getByRole('menuitem', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/$/)
  })
})
