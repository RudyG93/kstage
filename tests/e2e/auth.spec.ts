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

  test('sign in, follow, multi-filter, see My events, sign out', async ({ page }) => {
    // Sign in → redirigé vers /my.
    await page.goto('/login')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/my$/)

    // Suivre un groupe (idempotent : si déjà suivi, le bouton "Follow" est absent).
    await page.goto('/groups')
    const firstFollow = page.getByRole('button', { name: 'Follow' }).first()
    if (await firstFollow.count()) await firstFollow.click()
    await expect(page.getByRole('button', { name: 'Following' }).first()).toBeVisible()

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

    // L'état "aucun groupe suivi" a disparu de /my.
    await page.goto('/my')
    await expect(page.getByRole('heading', { name: 'My events', level: 1 })).toBeVisible()
    await expect(page.getByText("You don't follow any groups yet.")).toHaveCount(0)

    // Sign out → ouvrir le menu compte (avatar) puis Sign out → retour à l'accueil.
    await page.getByRole('button', { name: 'Account menu' }).click()
    await page.getByRole('menuitem', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/$/)
  })
})
