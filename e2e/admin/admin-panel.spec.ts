import { test, expect } from '@playwright/test'
import { login, TEST_ADMIN, TEST_PLAYER } from '../helpers'

test.describe('Admin Panel', () => {
  test('admin sees the panel with a grouped sidebar that persists across sections', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin')

    const sidebar = page.getByTestId('admin-sidebar')
    await expect(sidebar).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('heading', { name: 'Admin Panel' })).toBeVisible()

    // Grouped headings present in the sidebar (heading role disambiguates from the
    // nav items, e.g. the "Packs" group vs the "Packs" link).
    for (const g of ['General', 'Content', 'Packs', 'Arena Systems', 'Player Management', 'Player Interactions', 'Audit']) {
      await expect(sidebar.getByRole('heading', { name: g, exact: true })).toBeVisible()
    }

    // Clicking a section navigates to its tool, and the sidebar persists.
    await sidebar.getByRole('link', { name: 'Cards' }).click()
    await expect(page).toHaveURL(/\/admin\/cards/, { timeout: 10000 })
    await expect(page.getByTestId('admin-sidebar')).toBeVisible()
  })

  test('non-admin is redirected away from the panel', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
  })

  test('non-admin is redirected from a deep admin route', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/admin/cards')
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
  })

  test('dashboard shows the Admin Panel link for admins', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/dashboard')
    await expect(page.getByRole('link', { name: /Admin Panel/ })).toBeVisible({ timeout: 10000 })
  })
})
