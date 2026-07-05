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

  // Chromium uniquement : le golden path MUTE l'état du compte test partagé
  // (follows) et le signOut Supabase est global (révoque toutes les sessions).
  // Deux projets en parallèle sur le même compte = interférences flaky en CI.
  // L'UI auth est indépendante du viewport ; mobile garde smoke/search/feedback.
  test.skip(({ isMobile }) => Boolean(isMobile), 'Golden path sur chromium seul (compte partagé).')

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
    // ⚠️ exact:true OBLIGATOIRE : getByRole matche par sous-chaîne par défaut,
    // donc { name: 'Follow' } matche AUSSI « Unfollow » — le test cliquait le
    // 1er bouton Unfollow et désabonnait un groupe du compte test à chaque run
    // (données réelles détruites, découvert le 2026-07-05).
    await page.goto('/groups')
    const firstFollow = page.getByRole('button', { name: 'Follow', exact: true }).first()
    if (await firstFollow.count()) await firstFollow.click()
    await expect(page.getByRole('button', { name: 'Unfollow', exact: true }).first()).toBeVisible()

    // Filtres de type : chips URL-driven de la page Calendar (Data Desk §7.2 —
    // le TypeFilterVertical de la home a été remplacé par ces chips).
    await page.goto('/calendar')

    // 1er filtre : "MV" → URL contient `type=mv`.
    const mvChip = page.getByRole('link', { name: 'MV', exact: true })
    await mvChip.scrollIntoViewIfNeeded()
    await mvChip.click()
    await expect(page).toHaveURL(/[?&]type=mv(?:[,&]|$)/)
    await expect(mvChip).toHaveAttribute('aria-current', 'true')

    // 2e filtre : "Release" → URL CSV `type=mv,release` (insertion order ;
    // URLSearchParams encode la virgule en %2C).
    const releaseChip = page.getByRole('link', { name: 'Release', exact: true })
    await releaseChip.click()
    await expect(page).toHaveURL(/[?&]type=mv(?:%2C|,)release(?:[,&]|$)/)
    await expect(releaseChip).toHaveAttribute('aria-current', 'true')

    // Re-click MV → URL ne contient plus que `release`.
    await mvChip.click()
    await expect(page).toHaveURL(/[?&]type=release(?:[,&]|$)/)
    await expect(mvChip).not.toHaveAttribute('aria-current', 'true')

    // La home connectée affiche la sidebar "My groups" (preuve d'état connecté
    // + au moins un groupe suivi → l'empty-state a disparu).
    await page.goto('/')
    await expect(page.getByText('My groups')).toBeVisible()
    await expect(page.getByText("You don't follow any groups yet.")).toHaveCount(0)

    // Sign out → ouvrir le menu compte (avatar) puis Sign out → retour à l'accueil.
    await page.getByRole('button', { name: 'Account menu' }).click()
    await page.getByRole('menuitem', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/$/)
  })
})
