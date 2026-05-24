import { test, expect } from '@playwright/test'

test('/test displays events from DB', async ({ page }) => {
  await page.goto('/test')
  await expect(page.getByRole('heading', { name: /upcoming events/i })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Upcoming events' })).toBeVisible()
})
