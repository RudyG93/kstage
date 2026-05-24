import { test, expect } from '@playwright/test'

test('home shows the upcoming events page', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Upcoming', level: 1 })).toBeVisible()
  await expect(page.getByLabel('Filter by group')).toBeVisible()
})

test('filtering by group updates the URL', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Filter by group').selectOption({ index: 1 })
  await expect(page).toHaveURL(/group=/)
})

test('filtering by type updates the URL', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Comeback' }).click()
  await expect(page).toHaveURL(/type=comeback/)
})

test('calendar page renders the month grid', async ({ page }) => {
  await page.goto('/calendar')
  await expect(page.getByRole('heading', { name: 'Calendar', level: 1 })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Next month' })).toBeVisible()
})
