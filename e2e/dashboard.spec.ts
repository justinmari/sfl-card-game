import { test, expect } from '@playwright/test'
import { login, TEST_ADMIN, TEST_PLAYER } from './helpers'

test.describe('Dashboard', () => {
  test('shows main navigation tiles', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await expect(page.getByText('Shop')).toBeVisible()
    await expect(page.getByText('Collection')).toBeVisible()
    await expect(page.getByText('Friends')).toBeVisible()
    await expect(page.getByText('Changelog')).toBeVisible()
  })

  test('shows arena section', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await expect(page.locator('a[href="/arena"]')).toBeVisible()
    await expect(page.locator('a[href="/decks"]')).toBeVisible()
  })

  test('admin sees all admin tiles', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await expect(page.getByText('Manage Cards')).toBeVisible()
    await expect(page.getByText('Manage Packs')).toBeVisible()
    await expect(page.getByText('Creatures')).toBeVisible()
    await expect(page.getByText('Users')).toBeVisible()
    await expect(page.getByText('Skills')).toBeVisible()
    await expect(page.getByText('Test Arena')).toBeVisible()
    await expect(page.getByText('Feature Settings')).toBeVisible()
  })

  test('shop link works', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.click('a[href="/shop"]')
    await expect(page).toHaveURL(/\/shop/)
  })

  test('collection link works', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.click('a[href="/collection"]')
    await expect(page).toHaveURL(/\/collection/)
  })
})
