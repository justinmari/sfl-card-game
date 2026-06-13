import { test, expect } from '@playwright/test'
import { login, TEST_ADMIN } from '../helpers'

test.describe('Admin Skills', () => {
  test('admin can access manage skills page', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/skills')
    await expect(page.getByText('Manage Skills')).toBeVisible({ timeout: 10000 })
    await test.info().attach('skills-page', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('shows empty state when no skills exist', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/skills')
    await expect(page.getByText('Manage Skills')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('No skills defined yet.')).toBeVisible({ timeout: 5000 })
    await test.info().attach('no-skills', { body: await page.screenshot(), contentType: 'image/png' })
  })
})
