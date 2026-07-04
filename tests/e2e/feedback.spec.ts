import { test, expect } from '@playwright/test'

// Widget Feedback (footer, toutes pages) : canal critique de signalement des
// fausses données. UI seulement, SANS submit — un vrai submit écrirait en prod
// et le cap 2/24h rendrait le 2ᵉ run CI de la journée flaky. Le chemin submit
// (validation, rate-limit) est couvert côté serveur (RPC atomique + CHECK DB).

test.describe('Feedback widget', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Feedback' }).click()
    await expect(page.getByText('Send feedback')).toBeVisible()
  })

  test('toggle idea/bug : aria-checked + placeholder contextuel', async ({ page }) => {
    const idea = page.getByRole('radio', { name: /idea/i })
    const bug = page.getByRole('radio', { name: /bug/i })
    await expect(idea).toHaveAttribute('aria-checked', 'true')

    await bug.click()
    await expect(bug).toHaveAttribute('aria-checked', 'true')
    await expect(idea).toHaveAttribute('aria-checked', 'false')
    await expect(page.getByPlaceholder(/what went wrong/i)).toBeVisible()
  })

  test('Send disabled < 10 chars, enabled après, compteur à jour', async ({ page }) => {
    const send = page.getByRole('button', { name: 'Send' })
    const body = page.locator('textarea[name="body"]')

    await expect(send).toBeDisabled()
    await expect(page.getByText('0/500')).toBeVisible()

    await body.fill('short') // 5 chars < min 10
    await expect(send).toBeDisabled()

    const valid = 'This calendar entry looks wrong to me.'
    await body.fill(valid)
    await expect(send).toBeEnabled()
    await expect(page.getByText(`${valid.length}/500`)).toBeVisible()
  })

  test('Escape ferme le dialog', async ({ page }) => {
    await page.keyboard.press('Escape')
    await expect(page.getByText('Send feedback')).toBeHidden()
  })
})
