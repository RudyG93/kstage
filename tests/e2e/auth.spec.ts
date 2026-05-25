import { test, expect } from '@playwright/test'

// Golden path : login → follow → mes events → logout.
// Utilise un compte test fixe (confirmé côté Supabase) fourni via env.
// Skip proprement si non configuré, pour ne pas casser la CI.
const email = process.env.E2E_AUTH_EMAIL ?? ''
const password = process.env.E2E_AUTH_PASSWORD ?? ''

test.describe('auth golden path', () => {
  test.skip(
    !email || !password,
    'Set E2E_AUTH_EMAIL / E2E_AUTH_PASSWORD (a confirmed Supabase user) to run.',
  )

  test('sign in, follow a group, see it in My events, sign out', async ({ page }) => {
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

    // L'état "aucun groupe suivi" a disparu de /my.
    await page.goto('/my')
    await expect(page.getByRole('heading', { name: 'My events', level: 1 })).toBeVisible()
    await expect(page.getByText("You don't follow any groups yet.")).toHaveCount(0)

    // Sign out → retour à l'accueil.
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/$/)
  })
})
