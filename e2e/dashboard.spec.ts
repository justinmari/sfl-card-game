import { test, expect } from '@playwright/test'
import { login, TEST_ADMIN, TEST_PLAYER } from './helpers'

test.describe('Dashboard', () => {
  test('shows main navigation tiles', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await expect(page.getByText('Shop')).toBeVisible()
    await expect(page.getByText('Collection')).toBeVisible()
    await expect(page.getByText('Friends')).toBeVisible()
    // exact: the changelog teaser also contains "View full changelog →".
    await expect(page.getByText('Changelog', { exact: true })).toBeVisible()
  })

  test('shows arena section', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await expect(page.locator('a[href="/arena"]')).toBeVisible()
    await expect(page.locator('a[href="/decks"]')).toBeVisible()
  })

  test('admin sees the Admin Panel link', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await expect(page.getByRole('link', { name: /Admin Panel/ })).toBeVisible()
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

  test('shows the latest changelog teaser and links to /changelog', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/dashboard')

    const teaser = page.getByTestId('changelog-teaser')
    await expect(teaser).toBeVisible({ timeout: 10000 })
    await expect(teaser).toContainText("What's new")
    // Seeded changelog version (supabase/seed.sql).
    await expect(teaser).toContainText('v9.9.9')

    await teaser.click()
    await expect(page).toHaveURL(/\/changelog/)
    await test.info().attach('changelog-teaser', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('navbar version reflects the latest changelog entry', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/dashboard')
    // The home navbar's version badge is driven by the latest changelogs row
    // (seeded as v9.9.9 in supabase/seed.sql), not a hardcoded string.
    await expect(page.locator('nav').getByText('v9.9.9')).toBeVisible({ timeout: 10000 })
  })
})
